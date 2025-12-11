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

async function readCardId(req: Request): Promise<number> {
  const url = new URL(req.url);
  const qId = url.searchParams.get("id") || url.searchParams.get("card_id");
  if (isNumericString(qId)) return Number(qId);

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({} as any));
    const id =
      typeof j.id === "number" ? j.id :
      typeof j.card_id === "number" ? j.card_id :
      (typeof j.id === "string" && isNumericString(j.id)) ? Number(j.id) :
      (typeof j.card_id === "string" && isNumericString(j.card_id)) ? Number(j.card_id) :
      null;
    if (id != null) return id;
  } else {
    const raw = await req.text().catch(() => "");
    if (isNumericString(raw.trim())) return Number(raw.trim());
  }
  throw new Error("Missing or invalid card_id. Provide as JSON { id } or { card_id }, query ?id=, or raw numeric body.");
}

async function readRequestData(req: Request): Promise<{ cardId: number; isPpl: boolean | null }> {
  const cardId = await readCardId(req);
  
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({} as any));
    const isPpl = typeof j.is_ppl === "boolean" ? j.is_ppl : null;
    return { cardId, isPpl };
  }
  
  return { cardId, isPpl: null };
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

/** Build a quoted excerpt ≤ 1000 chars from relevant sentences; allow disjoint segments separated by […] */
function buildQuotedExcerpt(fullText: string, title: string, subtext: string, maxChars = 1000): string {
  const focus = (title + " " + subtext).toLowerCase();
  const focusTerms = Array.from(new Set(focus.split(/[^a-z0-9]+/i).filter(Boolean)));

  const sentences = fullText
    .replace(/\s+/g, " ")
    .split(/(?<=[\.\!\?]["”’)]?)\s+/);

  const scored = sentences.map((s, i) => {
    const low = s.toLowerCase();
    let score = 0;
    for (const t of focusTerms) if (low.includes(t)) score++;
    const len = s.length;
    if (len > 40 && len < 600) score += 0.3;
    return { s: s.trim(), i, score };
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
    const clip = fullText.trim().slice(0, Math.max(0, maxChars - 2));
    const safe = clip.replace(/\s+\S*$/, "");
    return `"${safe}"`;
  }

  let out = `"${chosen[0]}"`;
  for (let i = 1; i < chosen.length; i++) {
    out += ` "[...]" "${chosen[i]}"`;
  }
  if (out.length > maxChars) out = out.slice(0, maxChars - 1) + "”";
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

/** ======= main ======= */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1) Input: card_id and is_ppl
    const { cardId, isPpl: requestIsPpl } = await readRequestData(req);

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

    // 6) Generate body_text + tldr with Mistral
    // Use request isPpl if provided, otherwise fall back to database value
    const isPpl = requestIsPpl !== null ? requestIsPpl : (card.is_ppl === true);
    const { body, tldr } = await mistralBodyAndTldr({
      title: String(card.title || ""),
      subtext: String(card.subtext || ""),
      pageText: fullText,
      isPpl: isPpl,
      excerpt
    });

    if (!body) {
      return new Response(JSON.stringify({ error: "Model returned empty body" }), {
        status: 502, headers: { "Content-Type": "application/json" }
      });
    }

    // 7) Upsert excerpt into web_content.excerpt (keep existing behavior)
    if (card.web_id != null) {
      const { error: wUpdErr } = await supabase
        .from("web_content")
        .update({ excerpt })
        .eq("id", card.web_id);
      if (wUpdErr) console.error("web_content update failed (by id):", wUpdErr);
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
        if (wUpd2) console.error("web_content update failed (by path):", wUpd2);
      } else {
        const insRow: Record<string, any> = { path: webPath, excerpt };
        if (link1) insRow.link = link1;
        const { error: wInsErr } = await supabase.from("web_content").insert(insRow);
        if (wInsErr) console.error("web_content insert failed:", wInsErr);
      }
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
