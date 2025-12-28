/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ======= config ======= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

// model: always use Medium
const MISTRAL_MEDIUM = "mistral-small-latest";

/** ======= supabase client ======= */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ======= helpers ======= */
function isNumericString(s: string | null): boolean {
  return !!s && /^\d+$/.test(s);
}

function isValidUuid(s: string | null): boolean {
  if (!s) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(s);
}

async function readRequestData(req: Request): Promise<{ cardId: number; isPpl: boolean | null; userId: string | null }> {
  const url = new URL(req.url);
  
  // Try query params first
  const qId = url.searchParams.get("id") || url.searchParams.get("card_id");
  const qUserId = url.searchParams.get("user_id") || url.searchParams.get("userId");
  
  let cardId: number | null = null;
  let userId: string | null = null;
  let isPpl: boolean | null = null;
  
  if (isNumericString(qId)) {
    cardId = Number(qId);
  }
  if (qUserId && isValidUuid(qUserId)) {
    userId = qUserId;
  }
  
  // Try request body if needed
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({} as any));
    
    // Extract card_id
    if (cardId === null) {
      const id =
        typeof j.id === "number" ? j.id :
        typeof j.card_id === "number" ? j.card_id :
        (typeof j.id === "string" && isNumericString(j.id)) ? Number(j.id) :
        (typeof j.card_id === "string" && isNumericString(j.card_id)) ? Number(j.card_id) :
        null;
      if (id != null) cardId = id;
    }
    
    // Extract user_id
    if (userId === null) {
      const uid = typeof j.user_id === "string" ? j.user_id :
                  typeof j.userId === "string" ? j.userId :
                  typeof j.uuid === "string" ? j.uuid :
                  null;
      if (uid && isValidUuid(uid)) userId = uid;
    }
    
    // Extract is_ppl
    if (typeof j.is_ppl === "boolean") {
      isPpl = j.is_ppl;
    }
  } else if (!cardId) {
    // Try raw body as card_id
    const raw = await req.text().catch(() => "");
    if (isNumericString(raw.trim())) {
      cardId = Number(raw.trim());
    }
  }
  
  if (cardId === null) {
    throw new Error("Missing or invalid card_id. Provide as JSON { id } or { card_id }, query ?id=, or raw numeric body.");
  }
  
  return { cardId, isPpl, userId };
}

function isValidUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  try { new URL(u); return true; } catch { return false; }
}

/** ======= funding / scope regex patterns ======= */
const RE_APPROPRIATION = /\b(appropriation|authorization|authorized|appropriated|rescission|rescind)\b/i;
const RE_MONEY = /(\$\s?\d|billion|million)\b/i;
const RE_GLOBAL_FUNDING_PHRASES = /\b(funding|funds|budget|spending|costs?)\b/i;
const RE_MAX_BENEFIT_PHRASES = /\b(maximum\s+(federal\s+)?pell\s+grant|max(imum)?\s+benefit|per[-\s]student|per[-\s]person|per[-\s]household)\b/i;
const RE_SHORTFALL = /\b(shortfall|reserve|deficit)\b/i;

type CardFundingKind = "non_funding" | "funding_benefit_like" | "funding_appropriation_like";

function classifyCardFundingKind(title: string, subtext: string): CardFundingKind {
  const t = (title || "").toLowerCase();
  const s = (subtext || "").toLowerCase();
  const combined = `${t} ${s}`;

  const hasMoney = RE_MONEY.test(combined);
  const hasAppro = RE_APPROPRIATION.test(combined);
  const hasMaxBenefit = RE_MAX_BENEFIT_PHRASES.test(combined);
  const hasGlobalFunding = RE_GLOBAL_FUNDING_PHRASES.test(t);

  if (!hasMoney && !hasAppro && !hasGlobalFunding && !hasMaxBenefit) {
    return "non_funding";
  }

  // If it talks about "maximum grant/benefit" or per-person terms, treat as benefit-like (higher risk)
  if (hasMaxBenefit) {
    return "funding_benefit_like";
  }

  // Appropriations, shortfall, reserve, etc., but no explicit per-person phrasing
  if (hasAppro || RE_SHORTFALL.test(combined) || hasGlobalFunding) {
    return "funding_appropriation_like";
  }

  return "non_funding";
}

function sanitizeFundingNarrative(opts: {
  body: string;
  tldr: string;
  title: string;
  subtext: string;
  kind: CardFundingKind;
}): { body: string; tldr: string; changed: boolean } {
  let { body, tldr } = opts;
  let changed = false;

  const srcCombined = `${(opts.title || "").toLowerCase()} ${(opts.subtext || "").toLowerCase()}`;
  const bodyLower = body.toLowerCase();
  const tldrLower = tldr.toLowerCase();

  const mentionsMaxBenefit = RE_MAX_BENEFIT_PHRASES.test(bodyLower) || RE_MAX_BENEFIT_PHRASES.test(tldrLower);
  const mentionsGlobalFunding = RE_GLOBAL_FUNDING_PHRASES.test(tldrLower) || RE_GLOBAL_FUNDING_PHRASES.test(bodyLower);

  // If card kind is "funding_appropriation_like" (no per-person formula in title/subtext),
  // we should NOT introduce maximum benefit language in the narrative.
  if (opts.kind === "funding_appropriation_like" && mentionsMaxBenefit) {
    // Drop sentences that contain max-benefit phrasing
    const sentenceSplitter = /(?<=[\.\!\?])\s+/;
    const bodySentences = body.split(sentenceSplitter);
    const safeSentences = bodySentences.filter(
      s => !RE_MAX_BENEFIT_PHRASES.test(s.toLowerCase())
    );
    if (safeSentences.length > 0) {
      body = safeSentences.join(" ");
      changed = true;
    }
    if (RE_MAX_BENEFIT_PHRASES.test(tldrLower)) {
      tldr = "";
      changed = true;
    }
  }

  // If card kind is funding-related and title/subtext do NOT talk about "maximum benefit"
  // but narrative does, treat that as overreach.
  const srcHasMaxBenefit = RE_MAX_BENEFIT_PHRASES.test(srcCombined);
  if (!srcHasMaxBenefit && mentionsMaxBenefit) {
    const sentenceSplitter = /(?<=[\.\!\?])\s+/;
    const bodySentences = body.split(sentenceSplitter);
    const safeSentences = bodySentences.filter(
      s => !RE_MAX_BENEFIT_PHRASES.test(s.toLowerCase())
    );
    if (safeSentences.length > 0) {
      body = safeSentences.join(" ");
      changed = true;
    }
    if (RE_MAX_BENEFIT_PHRASES.test(tldrLower)) {
      tldr = "";
      changed = true;
    }
  }

  // Optional: guard against very strong "funding for Program X rises from A to B" claims in TLDR
  // when title/subtext are more cautious.
  // You can pattern-match "funding for X rises/increases from" and blank that sentence.

  return { body, tldr, changed };
}

/** Download entire stored page text (no truncation) */
async function downloadFullText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(WEB_BUCKET).download(path);
  if (error) throw error;
  return await data.text();
}

/** Clean a sentence by removing links, formatting, metadata, and other non-content elements */
function cleanExcerptSentence(sentence: string): string {
  let s = sentence;
  
  // Remove markdown/HTML links entirely: [text](url) → ""
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '');
  
  // Remove standalone URLs
  s = s.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove markdown formatting
  s = s.replace(/#{1,6}\s*/g, ''); // headers
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
  s = s.replace(/\*([^*]+)\*/g, '$1'); // italic
  s = s.replace(/`([^`]+)`/g, '$1'); // code
  
  // Remove image markdown
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');
  
  // Remove HTML tags
  s = s.replace(/<[^>]+>/g, '');
  
  // Remove metadata labels (case insensitive)
  s = s.replace(/\b(Signed|Published|Date|Outcome|Bill No\.?|FR Citation|FR Doc\.?|Number|Permalink|See|More information about|About the|Click here|Read more)\s*:\s*/gi, '');
  
  // Normalize punctuation issues
  s = s.replace(/:\s*:/g, ':'); // ": :" → ":"
  s = s.replace(/\|\s*\|/g, ''); // Remove table separators
  s = s.replace(/\|/g, ''); // Remove remaining pipes
  
  // Remove table markdown separators
  s = s.replace(/[-]{3,}/g, '');
  
  // Remove extra punctuation artifacts
  s = s.replace(/\.{2,}/g, '.'); // Multiple periods
  s = s.replace(/,{2,}/g, ','); // Multiple commas
  
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ');
  
  // Trim
  s = s.trim();
  
  return s;
}

/** Check if a sentence looks like a header, navigation element, or metadata rather than actual content */
function isHeaderLike(sentence: string): boolean {
  const s = sentence.trim();
  
  // Too short (likely a header or label)
  if (s.length < 20) return true;
  
  // All caps (likely a header) - check if most alpha characters are uppercase
  const alphaOnly = s.replace(/[^a-zA-Z]/g, '');
  if (alphaOnly.length > 5 && alphaOnly === alphaOnly.toUpperCase()) return true;
  
  // Starts with common metadata/navigation patterns
  if (/^(Signed|Published|Date|Outcome|Bill No|FR Citation|Number|Permalink|See|More information|About|Click|Read more|Login|Forgot|Register|Subscribe|Download|PDF|Print)/i.test(s)) return true;
  
  // Contains mostly non-alphabetic characters (metadata junk like "86 FR 58551")
  const nonAlpha = s.replace(/[a-zA-Z\s]/g, '').length;
  const total = s.length;
  if (total > 0 && nonAlpha / total > 0.5) return true;
  
  // Looks like a navigation or UI element (contains certain patterns)
  if (/\*\*|\[|\]|Login|Password|Sign up|Register/i.test(s)) return true;
  
  return false;
}

/** Build a quoted excerpt ≤ 1000 chars from relevant sentences; allow disjoint segments separated by […] */
function buildQuotedExcerpt(fullText: string, title: string, subtext: string, maxChars = 1000): string {
  const focus = (title + " " + subtext).toLowerCase();
  const focusTerms = Array.from(new Set(focus.split(/[^a-z0-9]+/i).filter(Boolean)));

  const sentences = fullText
    .replace(/\s+/g, " ")
    .split(/(?<=[\.\!\?][""')]?)\s+/);

  // Clean and filter sentences BEFORE scoring
  const cleanedSentences = sentences
    .map((s, i) => ({ original: s.trim(), cleaned: cleanExcerptSentence(s.trim()), index: i }))
    .filter(({ cleaned }) => cleaned.length > 0 && !isHeaderLike(cleaned));

  // If no valid sentences after cleaning, return fallback
  if (cleanedSentences.length === 0) {
    return '"No readable excerpt available."';
  }

  // Score the cleaned sentences
  const scored = cleanedSentences.map(({ cleaned, index }) => {
    const low = cleaned.toLowerCase();
    let score = 0;
    for (const t of focusTerms) if (low.includes(t)) score++;
    const len = cleaned.length;
    if (len > 40 && len < 600) score += 0.3;
    return { s: cleaned, i: index, score };
  });

  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));

  const chosen: string[] = [];
  let total = 0;

  for (const { s } of scored) {
    if (!s) continue;
    const addLen = chosen.length ? (5 + s.length + 2) : (s.length + 2); // quotes + "[...]" spacing approx
    if (total + addLen > maxChars) continue;
    chosen.push(s);
    total += addLen;
    if (total >= maxChars * 0.9) break;
  }

  if (chosen.length === 0) {
    return '"No readable excerpt available."';
  }

  // Reassemble with quotes and [...]
  let out = `"${chosen[0]}"`;
  for (let i = 1; i < chosen.length; i++) {
    out += ` "[...]" "${chosen[i]}"`;
  }
  
  // Note: Don't truncate after cleaning - if it's short, that's okay
  return out;
}

/** Call Mistral once; if it fails due to context, retry with last 10k chars strategy per policy */
async function mistralBodyAndTldr(opts: {
  title: string;
  subtext: string;
  pageText: string; // full, untruncated
  isPpl: boolean;
  excerpt: string;  // new
}): Promise<{ body: string; tldr: string }> {
  const minWords = opts.isPpl ? 150 : 50;
  const maxWords = 250;

  const kind = classifyCardFundingKind(opts.title, opts.subtext);
  // Optional: bypass funding logic for people cards
  const effectiveKind: CardFundingKind = opts.isPpl ? "non_funding" : kind;

  const sys = `You write neutral, factual political explainer text at a clear U.S. high-school reading level.
Return ONLY JSON like: {"body":"...","tldr":"..."} with valid JSON keys.
Rules:
- BODY: aim between ${minWords}-${maxWords} words (do not exceed ${maxWords}).
- TLDR: aim between 20-50 words and summarize the BODY you just wrote (do BODY first).
- Use only information from the provided source text; do not fabricate.
- Do NOT rewrite or "upgrade" the card's claim; your job is to explain what the cited section does, not speculate beyond it.

Funding vs benefits (CRITICAL):
- If the underlying section is about appropriations, authorizations, reserves, or shortfalls, describe it as a change to PROGRAM FUNDING in that section, not as "benefits increasing for people" or "total program funding changing" unless the text clearly states this.
- Only describe "maximum benefit", "maximum grant", or per-person amounts when the statute explicitly defines or changes those formulas.
- Do NOT claim that total funding for a whole program rose from A to B based on a single subsection that may apply only to a reserve, shortfall, or sub-program.
- When in doubt, speak in terms of "this section" or "this funding line" rather than "Program X overall".
- CARD_TYPE_FUNDING tells you if the card is about funding/appropriations; apply the funding vs benefits rules most strictly when it is "funding_appropriation_like" or "funding_benefit_like".
- Ground your explanation primarily in the PRIMARY EXCERPT. Use the full source page only for clarifying context, not to invent broader claims unrelated to that excerpt.`;

  const user = `
CARD TITLE: ${opts.title}
CARD SUBTEXT: ${opts.subtext}
CARD_TYPE_FUNDING: ${effectiveKind}  // non_funding | funding_appropriation_like | funding_benefit_like

PRIMARY EXCERPT (most relevant legal lines for this card; treat this as your main evidence):
${opts.excerpt}

FULL SOURCE PAGE (for additional context only; do not contradict the excerpt):
"""${opts.pageText}"""
`;

  async function callOnce(payloadText: string) {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: MISTRAL_MEDIUM,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user.replace(opts.pageText, payloadText) }
        ],
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`Mistral error ${r.status}`);
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {}
    const body = String(parsed?.body ?? "").trim();
    const tldr = String(parsed?.tldr ?? "").trim();
    return { body, tldr };
  }

  const kindForSanitizer = opts.isPpl ? "non_funding" : classifyCardFundingKind(opts.title, opts.subtext);

  function applySanitizer(body: string, tldr: string): { body: string; tldr: string } {
    const sanitized = sanitizeFundingNarrative({
      body,
      tldr,
      title: opts.title,
      subtext: opts.subtext,
      kind: kindForSanitizer
    });

    if (sanitized.changed) {
      console.warn("funding_narrative_sanitized", {
        title: opts.title,
        kind: kindForSanitizer,
      });
    }

    // If body becomes empty after sanitization, provide a safe fallback
    if (!sanitized.body.trim()) {
      return {
        body: "This section makes technical changes to program funding; details require reading the full statute.",
        tldr: sanitized.tldr
      };
    }

    return { body: sanitized.body, tldr: sanitized.tldr };
  }

  try {
    const res = await callOnce(opts.pageText);
    if (res.body) {
      return applySanitizer(res.body, res.tldr);
    }
  } catch {}

  const last10k = opts.pageText.slice(-10_000);
  try {
    const res2 = await callOnce(last10k);
    if (res2.body) {
      return applySanitizer(res2.body, res2.tldr);
    }
  } catch {}

  try {
    const res3 = await callOnce(last10k);
    if (res3.body) {
      return applySanitizer(res3.body, res3.tldr);
    }
  } catch {}

  return { body: "No data available at this time", tldr: "" };
}

/** Parse onboard data string into key-value pairs */
function parseOnboardData(onboardData: string | null): Record<string, string> {
  const data: Record<string, string> = {};
  if (!onboardData) return data;

  const parts = onboardData.split(' | ');
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const key = part.substring(0, colonIndex).trim();
      const value = part.substring(colonIndex + 1).trim();
      data[key] = value;
    }
  }
  return data;
}

/** Generate personal impact text based on user demographics and card content */
async function generatePersonalImpact(opts: {
  title: string;
  subtext: string;
  bodyText: string;
  pageText: string;
  excerpt: string;
  onboardData: Record<string, string>;
}): Promise<{ impact: string; reasoning: string }> {
    // If no onboard data, return low impact message with reasoning included in impact text (max 50 words)
    const hasOnboardData = Object.keys(opts.onboardData).length > 0;
    if (!hasOnboardData) {
      const reasoning = "No demographic data available to assess personal impact.";
      const impactWithReasoning = "There is little to no personal impact for this info card. " + reasoning;
      console.log("Impact generation reasoning:", {
        hasReasoning: true,
        reasoning: reasoning,
        impactLength: impactWithReasoning.length,
        needsNote: false
      });
      return {
        impact: impactWithReasoning,
        reasoning: reasoning
      };
    }

  // Build demographic summary from onboard data
  const demographicFields = [
    "State Code", "Political Standing", "Highest Education Level", "Employment Status",
    "Income Level", "Race & Ethnicity", "Dependent Status", "Military Status",
    "Immigration Status", "Government Benefits", "Sexual Orientation", "Voter Eligibility",
    "Disability Status", "Industry of Work or Study", "Age", "Gender", "Political Involvement"
  ];
  
  const demographics: string[] = [];
  for (const field of demographicFields) {
    const value = opts.onboardData[field];
    if (value) {
      demographics.push(`${field}: ${value}`);
    }
  }

  const demographicSummary = demographics.length > 0 
    ? demographics.join(", ")
    : "No specific demographic information available";

  const sys = `You write personalized impact assessments for political/legislative information cards.
Return ONLY JSON like: {"impact":"...","needs_note":false,"reasoning":"..."} with valid JSON keys.
Rules:
- IMPACT: Write 0-100 words explaining how this card's information affects the person based on their demographics.
- If there is little to no direct correlation, write: "There is little to no personal impact for this info card"
- If there IS correlation, explain the specific impact clearly and concisely.
- If you find relevant information in the source document that isn't directly in the card but affects the person, you may include it, but set needs_note to true.
- The more direct the impact, the more you should write (up to 100 words).
- Be specific about which demographic factors create the impact.
- Write in a clear, accessible tone.
- REASONING (REQUIRED): Explain your decision-making process using the SAME CONTEXT as the card body text.
  * If there IS personal impact: Explain which demographic factors create the impact and how (can be longer, up to 100 words).
  * If there is NO personal impact: AIM for 50 words, but if additional context is needed to fully explain why there's no impact, you may use up to 100 words. Explain:
    - Which demographic factors you considered
    - Why none of them apply to this specific card's content
    - What the card is about that makes it irrelevant to the user's demographics
  * Prioritize being concise (50 words target), but include necessary context if it helps users understand why there's no impact (up to 100 words max).`;

  async function callOnce(payloadText: string) {
    const user = `
CARD TITLE: ${opts.title}
CARD SUBTEXT: ${opts.subtext}

CARD BODY TEXT (explanation of what this card is about):
${opts.bodyText}

PRIMARY EXCERPT (most relevant legal lines for this card):
${opts.excerpt}

FULL SOURCE PAGE (for additional context):
"""${payloadText}"""

USER DEMOGRAPHICS:
${demographicSummary}
`;

    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: MISTRAL_MEDIUM,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`Mistral error ${r.status}`);
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {}
    const impact = String(parsed?.impact ?? "").trim();
    const needsNote = parsed?.needs_note === true;
    const reasoning = String(parsed?.reasoning ?? "").trim();
    
    // Log reasoning (required - always log even if empty)
    console.log("Impact generation reasoning:", {
      hasReasoning: !!reasoning,
      reasoning: reasoning || "No reasoning provided by model",
      impactLength: impact.length,
      needsNote: needsNote
    });
    
    // Check if impact indicates low/no personal impact
    const isLowImpact = impact.toLowerCase().includes("little to no personal impact") || 
                        impact.toLowerCase().includes("no personal impact") ||
                        impact.toLowerCase().includes("minimal impact") ||
                        impact.trim().length === 0;
    
    // Add note if needed
    let finalImpact = impact;
    if (needsNote && impact && !impact.includes("Note:") && !impact.includes("note:")) {
      finalImpact = impact + " Note: While not directly related to this card, the source document mentions information that may be relevant to your demographic profile.";
    }
    
    // If low/no impact and we have reasoning, append reasoning to explain why
    // (Model should already keep it to 50-100 words per prompt instructions)
    if (isLowImpact && reasoning) {
      // Check if reasoning is already included in the impact text
      if (!finalImpact.includes(reasoning)) {
        finalImpact = finalImpact.trim();
        if (!finalImpact.endsWith(".") && !finalImpact.endsWith("!")) {
          finalImpact += ".";
        }
        finalImpact += " " + reasoning;
      }
    }
    
    // Fallback if impact is empty
    if (!finalImpact.trim()) {
      const fallbackImpact = "There is little to no personal impact for this info card.";
      if (reasoning) {
        // Model should already keep reasoning to 50-100 words per prompt instructions
        finalImpact = fallbackImpact + " " + reasoning;
      } else {
        finalImpact = fallbackImpact + " No specific demographic factors apply to this card's content.";
      }
    }
    
    return {
      impact: finalImpact,
      reasoning: reasoning
    };
  }

  try {
    const result = await callOnce(opts.pageText);
    if (result && result.impact) return result;
  } catch (e) {
    console.error("Error in impact generation (full text):", e);
  }

  const last10k = opts.pageText.slice(-10_000);
  try {
    const result = await callOnce(last10k);
    if (result && result.impact) return result;
  } catch (e) {
    console.error("Error in impact generation (last 10k):", e);
  }

  const fallbackReasoning = "Unable to assess personal impact due to processing error.";
  const fallbackImpact = "There is little to no personal impact for this info card. " + fallbackReasoning;
  console.log("Impact generation reasoning:", {
    hasReasoning: true,
    reasoning: fallbackReasoning,
    impactLength: fallbackImpact.length,
    needsNote: false
  });
  return {
    impact: fallbackImpact,
    reasoning: fallbackReasoning
  };
}

/** ======= main ======= */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1) Input: card_id, is_ppl, and user_id
    const { cardId, isPpl: requestIsPpl, userId } = await readRequestData(req);
    console.log("Request data:", { cardId, requestIsPpl, userId });

    // 2) Load the card_index row
    const { data: card, error: cErr } = await supabase
      .from("card_index")
      .select("id, title, subtext, score, link, web, is_ppl, web_id")
      .eq("id", cardId)
      .single();
    if (cErr || !card) {
      return new Response(JSON.stringify({ error: "card_index row not found" }), {
        status: 404, headers: { "Content-Type": "application/json" }
      });
    }

    // 3) Resolve link1 (prefer card.link; if missing/invalid, fallback to web_content.link)
    let link1: string | null = (card.link && isValidUrl(card.link)) ? String(card.link) : null;
    if (!link1 && card.web_id != null) {
      const { data: wrow } = await supabase
        .from("web_content")
        .select("link")
        .eq("id", card.web_id)
        .single();
      if (wrow?.link && isValidUrl(wrow.link)) link1 = String(wrow.link);
    }

    // 4) Download the exact file referenced by card_index.web (no truncation)
    const webPath: string = String(card.web || "");
    if (!webPath) {
      return new Response(JSON.stringify({ error: "card_index.web is empty; no source file to read" }), {
        status: 404, headers: { "Content-Type": "application/json" }
      });
    }

    let fullText = "";
    try {
      fullText = await downloadFullText(webPath);
    } catch (e) {
      console.error("download failed:", webPath, e);
      return new Response(JSON.stringify({ error: "Failed to download source text from storage" }), {
        status: 502, headers: { "Content-Type": "application/json" }
      });
    }
    if (!fullText.trim()) {
      return new Response(JSON.stringify({ error: "Source text is empty" }), {
        status: 404, headers: { "Content-Type": "application/json" }
      });
    }

    // 5) Build quoted excerpt (≤1000 chars) from relevant sentences (order by relevance/sense)
    const excerpt = buildQuotedExcerpt(fullText, String(card.title || ""), String(card.subtext || ""), 1000);

    // 5.5) Fetch user onboard data if user_id is provided
    let onboardData: Record<string, string> = {};
    if (userId) {
      try {
        console.log("Fetching onboard data for user:", userId);
        const { data: userRow, error: userErr } = await supabase
          .from("users")
          .select("onboard")
          .eq("uuid", userId)
          .maybeSingle();
        
        if (userErr) {
          console.error("Error fetching onboard data:", userErr);
        } else if (userRow?.onboard) {
          onboardData = parseOnboardData(userRow.onboard);
          console.log("Onboard data fetched, fields:", Object.keys(onboardData).length);
        } else {
          console.log("No onboard data found for user:", userId);
        }
      } catch (e) {
        console.error("Failed to fetch onboard data:", e);
      }
    } else {
      console.log("No user_id provided, skipping impact generation");
    }

    // 6) Generate body_text + tldr with Mistral (and impact in parallel if user_id provided)
    // Use request isPpl if provided, otherwise fall back to database value
    const isPpl = requestIsPpl !== null ? requestIsPpl : (card.is_ppl === true);
    
    // Start both generation tasks in parallel
    const bodyGenPromise = mistralBodyAndTldr({
      title: String(card.title || ""),
      subtext: String(card.subtext || ""),
      pageText: fullText,
      isPpl: isPpl,
      excerpt
    });

    // Wait for body generation first (we need body_text for impact generation)
    const { body, tldr } = await bodyGenPromise;

    if (!body) {
      return new Response(JSON.stringify({ error: "Model returned empty body" }), {
        status: 502, headers: { "Content-Type": "application/json" }
      });
    }

    // 6.5) Generate personal impact if user_id is provided (runs after body is generated)
    let impactText: string | null = null;
    if (userId) {
      try {
        console.log("Generating personal impact for user:", userId, "card:", cardId);
        const impactResult = await generatePersonalImpact({
          title: String(card.title || ""),
          subtext: String(card.subtext || ""),
          bodyText: body,
          pageText: fullText,
          excerpt,
          onboardData
        });
        impactText = impactResult.impact;
        console.log("Impact generated, length:", impactText?.length || 0);
        console.log("Impact reasoning logged above (see 'Impact generation reasoning' log entry)");
        
        // Save impact to impact table (upsert: update if exists, insert if not)
        try {
          // First check if a row already exists for this user_id + card_id
          const { data: existing, error: checkErr } = await supabase
            .from("impact")
            .select("id")
            .eq("user_id", userId)
            .eq("card_id", cardId)
            .maybeSingle();
          
          let impactData;
          let impactErr;
          
          if (checkErr && checkErr.code !== "PGRST116") {
            // PGRST116 is "not found" which is fine, other errors are real issues
            console.error("Error checking existing impact:", checkErr);
          }
          
          if (existing) {
            // Update existing row
            const { data, error } = await supabase
              .from("impact")
              .update({ impact: impactText })
              .eq("id", existing.id)
              .select();
            impactData = data;
            impactErr = error;
            if (impactErr) {
              console.error("Failed to update impact:", impactErr);
            } else {
              console.log("Impact updated successfully for existing row id:", existing.id);
            }
          } else {
            // Insert new row (don't specify id, let auto-increment handle it)
            const { data, error } = await supabase
              .from("impact")
              .insert({
                user_id: userId,
                card_id: cardId,
                impact: impactText
              })
              .select();
            impactData = data;
            impactErr = error;
            if (impactErr) {
              // If insert fails with duplicate key, try update instead
              if (impactErr.code === "23505") {
                console.log("Insert failed due to duplicate, trying update instead");
                const { data: updateData, error: updateErr } = await supabase
                  .from("impact")
                  .update({ impact: impactText })
                  .eq("user_id", userId)
                  .eq("card_id", cardId)
                  .select();
                if (updateErr) {
                  console.error("Failed to update impact after insert conflict:", updateErr);
                } else {
                  console.log("Impact updated successfully after insert conflict");
                  impactData = updateData;
                }
              } else {
                console.error("Failed to insert impact:", impactErr);
              }
            } else {
              console.log("Impact inserted successfully:", impactData);
            }
          }
        } catch (e) {
          console.error("Exception saving impact:", e);
        }
      } catch (e) {
        console.error("Failed to generate impact:", e);
        // Continue even if impact generation fails
      }
    } else {
      console.log("Skipping impact generation - no user_id provided");
    }

    // 7) Upsert excerpt into web_content.excerpt (keep existing behavior, but gracefully handle if column doesn't exist)
    try {
      if (card.web_id != null) {
        const { error: wUpdErr } = await supabase
          .from("web_content")
          .update({ excerpt })
          .eq("id", card.web_id);
        // Only log if it's not a schema error (PGRST204 = column doesn't exist)
        if (wUpdErr && (wUpdErr as any).code !== "PGRST204") {
          console.error("web_content update failed (by id):", wUpdErr);
        }
      } else {
        const { data: wFind, error: wFindErr } = await supabase
          .from("web_content")
          .select("id")
          .eq("path", webPath)
          .limit(1);
        if (!wFindErr && Array.isArray(wFind) && wFind.length > 0) {
          const { error: wUpd2 } = await supabase
            .from("web_content")
            .update({ excerpt })
            .eq("id", wFind[0].id);
          // Only log if it's not a schema error (PGRST204 = column doesn't exist)
          if (wUpd2 && (wUpd2 as any).code !== "PGRST204") {
            console.error("web_content update failed (by path):", wUpd2);
          }
        } else {
          // Insert without excerpt (excerpt column may not exist in schema)
          const insRow: Record<string, any> = { path: webPath };
          if (link1) insRow.link = link1;
          const { error: wInsErr } = await supabase.from("web_content").insert(insRow);
          if (wInsErr) console.error("web_content insert failed:", wInsErr);
        }
      }
    } catch (e) {
      // Silently continue if web_content excerpt update fails (column may not exist)
    }

    // 8) Upsert into card_content (now also writing excerpt to card_content.excerpt)
    const { data: existing, error: eErr } = await supabase
      .from("card_content")
      .select("id")
      .eq("card_id", cardId)
      .limit(1);
    if (eErr) throw eErr;

    if (Array.isArray(existing) && existing.length > 0) {
      // UPDATE (do not touch created_at)
      const updateRow: Record<string, any> = {
        title: String(card.title || ""),
        body_text: body,
        tldr: tldr,
        link1: link1 || null,
        excerpt: excerpt
      };
      const { error: upErr } = await supabase
        .from("card_content")
        .update(updateRow)
        .eq("card_id", cardId);
      if (upErr) throw upErr;

      return new Response(JSON.stringify({
        card_id: cardId,
        updated: true,
        link1
      }), { headers: { "Content-Type": "application/json" } });

    } else {
      // INSERT with created_at timestamp and excerpt
      const insertRow: Record<string, any> = {
        card_id: cardId,
        title: String(card.title || ""),
        body_text: body,
        tldr: tldr,
        link1: link1 || null,
        excerpt: excerpt,
        created_at: new Date().toISOString()
      };
      const { data: ins, error: insErr } = await supabase
        .from("card_content")
        .insert(insertRow)
        .select("id")
        .single();
      if (insErr) throw insErr;

      return new Response(JSON.stringify({
        card_id: cardId,
        created: true,
        content_id: ins?.id,
        link1
      }), { headers: { "Content-Type": "application/json" } });
    }

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
