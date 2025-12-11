/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONCURRENCY SLIDER ==========================
 * Single knob to control how aggressive card generation runs.
 * Range: 0.1 (very conservative) .. 1.5 (very aggressive)
 * Prefer setting via env: CARD_GEN_INTENSITY=1.0
 */
const CONCURRENCY_SLIDER = (() => {
  const raw = Number(Deno.env.get("CARD_GEN_INTENSITY") ?? 1.0);
  if (!Number.isFinite(raw)) return 1.0;
  return Math.min(1.5, Math.max(0.1, raw));
})();

/** Helpers to scale numbers safely */
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Derived concurrency knobs (scaled by slider)
 * - PARALLEL_REQUESTS: 5..30
 * - SAMPLES_PER_CHUNK_1: 1..6 (defaults to ~4 at slider=1.0)
 * - SAMPLES_PER_CHUNK_2: 1..3
 * - MAX_OUTPUT_TOKENS: 1800..3200
 */
const PARALLEL_REQUESTS = clamp(round(5 + 20 * CONCURRENCY_SLIDER), 5, 30);
const SAMPLES_PER_CHUNK_1 = clamp(round(1 + 3 * CONCURRENCY_SLIDER), 1, 6);
const SAMPLES_PER_CHUNK_2 = clamp(round(1 * CONCURRENCY_SLIDER), 1, 3);
const MAX_OUTPUT_TOKENS = clamp(round(1800 + 1400 * CONCURRENCY_SLIDER), 1800, 3200);

/** ========================== CONFIG (static) ========================== */
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const WEB_BUCKET      = Deno.env.get("WEB_BUCKET") || "web";

const MODEL_ID            = "mistral-small-latest";
const SOFT_MAX_CARDS      = 250;    // soft cap before DB insert (adjustable)
const PASS_MIN_CARDS      = 5;      // if total < 5, we’ll run a second sampling wave

/** Chunking */
const CHUNK_TARGET_CHARS   = 6_000; // target size per chunk
const CHUNK_OVERLAP_CHARS  = 1_000; // overlap to avoid split-context edge losses

/** ========================== CLIENT ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== HELPERS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function trim(s: unknown) {
  return String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}
function wordCount(s: string) {
  return trim(s).split(/\s+/).filter(Boolean).length;
}
function trimToWords(s: string, max: number) {
  const parts = trim(s).split(/\s+/);
  return parts.slice(0, max).join(" ");
}

/** Normalize to a de-dupe key (title + subtext; case/space insensitive) */
function normalizeKey(title: string, subtext: string) {
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();
  return norm(title) + "||" + norm(subtext);
}

/** Slug + near-duplicate helpers (borrowed from bill coverage flow) */
function slugify(s: string) {
  return s.toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function titleSimilarity(a: string, b: string): number {
  const A = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const inter = new Set([...A].filter(x => B.has(x))).size;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
}

/** Agenda side (screen = agenda_legi) */
const AGENDA_CATS = new Set(["action","scope","process","exceptions"]);
/** Impact side (screen = impact) */
const IMPACT_CATS = new Set(["sectors","demographics","regions","aftermath"]);

/** Category mapping (broad synonyms -> canonical) */
function canonicalizeCategory(raw: string): { screen: "agenda_legi" | "impact"; category: string } {
  const c0 = String(raw || "").toLowerCase().trim();
  const n = c0
    .replace(/exemption(s)?|exception(s)?/g, "exceptions")
    .replace(/implementation|administration|enforcement|procedure(s)?|process(es)?/g, "process")
    .replace(/coverage|applicability|reach|extent|scale|scope(s)?/g, "scope")
    .replace(/action(s)?|changes?|provision(s)?|measure(s)?|requirement(s)?/g, "action")
    .replace(/sector(s)?|industry|industries|field(s)?/g, "sectors")
    .replace(/population(s)?|group(s)?|people|citizen(s)?|resident(s)?|class(es)?|communities?/g, "demographics")
    .replace(/region(s)?|state(s)?|area(s)?|local(?:ity|ities)?|geograph(y|ic(al)?)?/g, "regions")
    .replace(/impact(s)?|effect(s)?|outcome(s)?|result(s)?|consequence(s)?|aftermath/g, "aftermath");

  if (AGENDA_CATS.has(n))   return { screen: "agenda_legi", category: n };
  if (IMPACT_CATS.has(n))   return { screen: "impact", category: n };
  return { screen: "agenda_legi", category: "action" };
}

/** Strengthen title/subtext clarity (titles 10–15 words, subtext ≤ 30 words) */
function normalizeTitleSubtext(tIn: string, sIn: string) {
  let title = trim(tIn);
  const tw = wordCount(title);
  if (tw > 15) title = trimToWords(title, 15);

  let sub = trim(sIn);
  const sw = wordCount(sub);
  if (sw > 30) sub = trimToWords(sub, 30);

  return { title, subtext: sub };
}

/** Optional Title Tagging (broad tag + optional subtag)
 *  IMPORTANT: For impact categories, DO NOT prefix with a tag (must lead with impact subject).
 */
function addTitleTagsIfConfigured(title: string, category: string, screen: "agenda_legi"|"impact"): string {
  if (screen === "impact") return title; // keep impact-first titles
  const lower = `${title} ${category}`.toLowerCase();
  let tag = "";
  let sub = "";

  if (lower.includes("snap")) { tag = "Social Programs"; sub = "SNAP"; }
  else if (lower.includes("medicaid")) { tag = "Healthcare"; sub = "Medicaid"; }
  else if (lower.includes("medicare")) { tag = "Healthcare"; sub = "Medicare"; }
  else if (lower.includes("tax")) { tag = "Taxes"; }
  else if (lower.includes("immigration") || lower.includes("asylum") || lower.includes("visa")) { tag = "Immigration"; }
  else if (lower.includes("defense") || lower.includes("military")) { tag = "Defense"; }
  else if (lower.includes("energy") || lower.includes("oil") || lower.includes("renewable") || lower.includes("epa")) { tag = "Energy & Environment"; }
  else if (lower.includes("education") || lower.includes("student loan") || lower.includes("pell")) { tag = "Education"; }
  else { tag = "Policy"; }

  return sub ? `${tag}, ${sub}: ${title}` : `${tag}: ${title}`;
}

/** Read JSON body with id */
async function readId(req: Request): Promise<number> {
  const url = new URL(req.url);
  const qId = url.searchParams.get("id");
  if (qId && /^\d+$/.test(qId)) return Number(qId);

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (typeof j?.id === "number") return j.id;
    if (typeof j?.id === "string" && /^\d+$/.test(j.id)) return Number(j.id);
  } else {
    const raw = (await req.text().catch(() => "")).trim();
    if (/^\d+$/.test(raw)) return Number(raw);
  }
  throw new Error("Missing or invalid id. Provide JSON { id }, query ?id=, or raw numeric body.");
}

/** Pull the legi row */
async function fetchLegiRow(id: number) {
  const { data, error } = await supabase
    .from("legi_index")
    .select("id, name, scanned")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("legi_index row not found");
  return data as { id: number; name: string; scanned: number | null };
}

/** List bill parts (web_content rows) for this legi id */
type PartRow = { web_id: number; path: string; link: string; part: number };

async function listBillParts(legiId: number): Promise<PartRow[]> {
  const { data, error } = await supabase
    .from("web_content")
    .select("id, path, link, owner_id")
    .eq("owner_id", legiId);
  if (error) throw error;

  const rows: PartRow[] = [];
  const REG = /\/(billtext|synopsis)\.(\d+)\.congress(?:\.(\d+))?\.txt$/i;
  for (const r of (data || [])) {
    const p = String(r?.path || "");
    const m = p.match(REG);
    if (!m) continue;
    const part = m[3] ? Number(m[3]) : 1;
    if (!Number.isFinite(part)) continue;
    rows.push({
      web_id: Number(r.id),
      path: p,
      link: String(r.link || ""),
      part,
    });
  }
  rows.sort((a, b) => a.part - b.part);
  return rows;
}

/** Which bill sections already have at least one card (is_ppl=false) */
async function fetchUsedSections(ownerId: number): Promise<Set<number>> {
  const { data, error } = await supabase
    .from("card_index")
    .select("bill_section")
    .eq("owner_id", ownerId)
    .eq("is_ppl", false);
  if (error) throw error;
  const used = new Set<number>();
  for (const r of (data || [])) {
    const n = Number(r?.bill_section);
    if (Number.isFinite(n)) used.add(n);
  }
  return used;
}

/** Download a bill part's text */
async function readFileText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(WEB_BUCKET).download(path);
  if (error) throw error;
  return await data.text();
}

/** ============ QUALITY FILTERS (Rubric) ============ */
const RE_LOW_VALUE_TITLE = /\b(short\s+title|table\s+of\s+contents|definitions?|rule\s+of\s+construction|findings|sense\s+of\s+congress|clerical|conforming|technical\s+corrections?)\b/i;
const RE_POLICY_VERB = /\b(require|prohibit|repeal|expand|reduce|increase|create|terminate|authorize|ban|limit|mandate|tax|subsidize|grant|penalize|enforce|preempt|rescind|rescission|fund|defund|reform|amend)\b/i;
const RE_APPROPRIATION = /\b(appropriation|authorization|authorized|appropriated|rescission|rescind)\b/i;
const RE_MONEY = /(\$\s?\d|billion|million)\b/i;
const RE_DEFINITIONY = /\b(definition|definitions)\b/i;
const RE_COVERAGE_CUES = /\b(include|includes|including|exclude|excludes|excluding|exempt|exemption|apply to|does not apply|covered|not covered)\b/i;
const RE_GLOBAL_FUNDING_PHRASES = /\b(funding|funds|budget|spending|costs?)\b/i;
const RE_MAX_BENEFIT_PHRASES = /\b(maximum\s+(federal\s+)?pell\s+grant|max(imum)?\s+benefit|per[-\s]student|per[-\s]person|per[-\s]household)\b/i;
const RE_SHORTFALL = /\b(shortfall|reserve|deficit)\b/i;

function isHighValueCard(title: string, subtext: string): boolean {
  const t = trim(title);
  const s = trim(subtext);

  if (RE_LOW_VALUE_TITLE.test(t)) {
    const definitionish = /\b(definitions?|rule\s+of\s+construction|findings|sense\s+of\s+congress)\b/i.test(t);
    if (definitionish) {
      const hasCoverageEffect = RE_COVERAGE_CUES.test(t) || RE_COVERAGE_CUES.test(s);
      const hasPolicyVerb = RE_POLICY_VERB.test(t) || RE_POLICY_VERB.test(s);
      if (!(hasCoverageEffect || hasPolicyVerb)) return false;
    } else {
      return false;
    }
  }

  if (!RE_POLICY_VERB.test(t) && !RE_POLICY_VERB.test(s)) return false;

  if (RE_APPROPRIATION.test(t) || RE_APPROPRIATION.test(s)) {
    if (!RE_MONEY.test(t) && !RE_MONEY.test(s)) return false;
  }

  if (RE_DEFINITIONY.test(t) || RE_DEFINITIONY.test(s)) {
    const altersCoverage = RE_COVERAGE_CUES.test(t) || RE_COVERAGE_CUES.test(s);
    if (!altersCoverage) return false;
  }

  return true;
}

function isFundingCardSafe(raw: RawCard, title: string, subtext: string): boolean {
  const t = trim(title);
  const s = trim(subtext);
  const combined = `${t} ${s}`;

  // Reusable regexes for funding language detection
  const globalFundingRise = /\bfunding\s+for\s+[^,]+(?:rises?|increases?|goes?\s+up)\s+from\b/i;
  const cautiousLanguage = /\b(this\s+section|subsection|reserve|shortfall|specific\s+program\s+line)\b/i;

  // If no appropriation cues, it's not a funding card - allow it
  if (!RE_APPROPRIATION.test(combined) && !RE_MONEY.test(combined)) {
    return true;
  }

  // It is a funding card - apply stricter rules
  const scope = raw.scope?.toLowerCase();
  const numberType = raw.number_type?.toLowerCase();

  // If model did not classify scope/number_type, be pessimistic for global-looking funding claims
  if (!scope && !numberType) {
    // Hard reject if it looks like a global funding/benefit statement
    if (
      RE_MAX_BENEFIT_PHRASES.test(combined) ||
      globalFundingRise.test(t) ||
      (RE_GLOBAL_FUNDING_PHRASES.test(t) && !cautiousLanguage.test(combined))
    ) {
      return false;
    }
    // Otherwise allow (e.g., narrow "this section appropriates $5M for X" without bad language)
    return true;
  }

  // If it's a benefit formula change for entire program, allow more freedom but require explicit "maximum grant" language
  if (numberType === "benefit_formula" && scope === "entire_program") {
    // Still require explicit maximum grant/benefit language
    if (!RE_MAX_BENEFIT_PHRASES.test(combined)) {
      return false;
    }
    return true;
  }

  // For appropriation_cap, shortfall_reserve, or subprogram/subsection scope, be very strict
  if (
    numberType === "appropriation_cap" ||
    numberType === "shortfall_reserve" ||
    scope === "subprogram" ||
    scope === "subsection"
  ) {
    // Reject if it mentions maximum benefit phrases (over-claiming)
    if (RE_MAX_BENEFIT_PHRASES.test(combined)) {
      return false;
    }

    // Reject if title says "funding for [program] rises from A to B" without clarifying it's a section/reserve
    if (globalFundingRise.test(t) && !RE_SHORTFALL.test(combined) && !cautiousLanguage.test(combined)) {
      return false;
    }

    // Allow if it uses cautious language like "this section increases the funding amount"
    if (cautiousLanguage.test(combined)) {
      return true;
    }

    // If wording is too broad and we can't reliably verify it's safe, reject
    if (RE_GLOBAL_FUNDING_PHRASES.test(t) && !cautiousLanguage.test(combined)) {
      return false;
    }
  }

  // Default: allow if we got here (conservative approach)
  return true;
}

/** ======== IMPACT STYLE VALIDATION (semi-strict guardrails) ======== */
const POLICY_FIRST_BLOCKLIST = /\b(require|prohibit|repeal|expand|reduce|increase|create|terminate|authorize|ban|limit|mandate|tax|subsidize|grant|penalize|enforce|preempt|rescind|reform|amend)\b/i;

const DEMO_HINTS = /\b(low-income|low income|seniors?|older adults|children|students|veterans|women|men|parents|famil(?:y|ies)|households?|immigrants?|asylum seekers?|refugees|lgbtq\+?|black|african american|latino|hispanic|asian|native (?:american|alaskan)|rural|urban)\b/i;
const IMPACT_VERBS = /\b(increase|decrease|reduce|expand|limit|restrict|boost|cut|decline|rise|fall|tighten|loosen|delay|accelerate)\b/i;
const REGION_HINTS = /\b(nationwide|state|states|county|counties|city|cities|metro|rural|urban|region|regions|territor(?:y|ies)|district)\b/i;
const FUTURE_TENSE = /\b(will|would|project(?:s|ed)?|expected to|could|may|likely)\b/i;

function impactStyleOk(category: string, title: string, subtext: string): boolean {
  const T = trim(title);
  const S = trim(subtext);

  // Titles must NOT lead with policy verbs for impact categories.
  if (POLICY_FIRST_BLOCKLIST.test(T.split(/\s+/)[0] || "")) return false;

  switch (category) {
    case "sectors":
      // Title should begin with or quickly mention a sector and express impact
      const hasImpactCue = IMPACT_VERBS.test(T) || /%|\b(more|less|fewer|greater|smaller)\b/i.test(T);
      const sectorish = /\b(parks?|hospitals?|clinics?|schools?|universit(?:y|ies)|colleges?|utilities?|power plants?|refineries?|farms?|manufactur(?:e|ers|ing)|airlines?|banks?|insurers?|pharmacies?|ports?|railroads?|transit|police|fire departments?)\b/i.test(T);
      return sectorish && hasImpactCue;

    case "demographics":
      return DEMO_HINTS.test(T) && IMPACT_VERBS.test(T + " " + S);

    case "regions":
      return REGION_HINTS.test(T) || /\bin\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/.test(T);

    case "aftermath":
      return FUTURE_TENSE.test(T + " " + S);

    default:
      return true;
  }
}

/** ============ CHUNKING + PARALLEL RUNNER ============ */
function makeChunks(text: string): string[] {
  const s = text;
  const len = s.length;
  if (len <= CHUNK_TARGET_CHARS) return [s];

  const chunks: string[] = [];
  let i = 0;
  while (i < len) {
    const end = Math.min(len, i + CHUNK_TARGET_CHARS);
    const slice = s.slice(i, end);
    chunks.push(slice);
    if (end >= len) break;
    i = end - CHUNK_OVERLAP_CHARS; // overlap
    if (i < 0) i = 0;
  }
  return chunks;
}

/** Lightweight pool (back-pressure via PARALLEL_REQUESTS) */
async function runLimited<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const active = new Set<Promise<void>>();

  async function launchOne(k: number) {
    const p = (async () => {
      try { results[k] = await worker(items[k], k); }
      catch (e) { /* @ts-ignore */ results[k] = null; console.warn("worker err", e); }
    })().finally(() => active.delete(p as any));
    active.add(p as any);
  }

  while (next < items.length && active.size < limit) {
    await launchOne(next++);
  }
  while (next < items.length) {
    await Promise.race(active);
    await launchOne(next++);
  }
  await Promise.all(active);
  return results;
}

/** ============ MISTRAL CALL ============ */
type RawCard = {
  title: string;
  subtext: string;
  category: string;
  scope?: string;        // e.g. "entire_program" | "subprogram" | "subsection" | "technical"
  number_type?: string; // e.g. "benefit_formula" | "appropriation_cap" | "shortfall_reserve" | "penalty" | "other"
};

function makeSystemPrompt() {
  return `
You analyze U.S. federal bill text and propose clear, factual cards for readers (high-school reading level).
Return ONLY JSON.

Card quality rules (strict):
- Only create a card if it reflects a MATERIAL policy change or direct impact grounded in the text: new/changed obligation, eligibility, benefit, penalty, subsidy, tax, rescission, mandate, enforcement, program creation/termination, funding with amounts/timing, or concrete implementation steps (agency, timeline).
- SKIP short titles, tables of contents, generic definitions, clerical/conforming/technical edits, "sense of Congress", "findings", and "rule of construction", UNLESS they directly change who is covered/exempted, preempt state rules, or change enforcement/authority in practice.
- Definitions are allowed ONLY if they materially narrow or widen who is covered/exempted.
- Appropriations are allowed ONLY with explicit dollar amounts and timing and when they change operations or availability.
- Every card must express ACTOR → ACTION → TARGET. For impact cards also specify WHO/WHICH SECTOR/WHERE and HOW they're affected.
- Use exactly one of these categories:
  agenda_legi: action | scope | process | exceptions
  impact: sectors | demographics | regions | aftermath
- Keep wording plain, neutral, and concrete. Titles 6–15 words; subtext one sentence, neutral, HS reading level.

Appropriations vs. benefits (CRITICAL):
- If the text changes authorized or appropriated dollar amounts but does NOT explicitly change a per-person benefit formula, describe it as a change to program funding in that section, not as "benefits increasing for people."
- Only describe "maximum benefit" / "maximum grant" / "per-person payments" when the statute explicitly uses those phrases and clearly defines or changes them.
- Do NOT claim that total funding for a program rose from A to B unless the text clearly states it covers the whole program (and not just a reserve, shortfall, or sub-program).
- Do NOT infer real-world totals from a single line of text.

Scope discipline:
- If scope is not "entire_program", you MUST phrase the card as "this section/subsection" or "this specific program line" rather than "Program X overall."

STRICT FORMAT RULES for IMPACT categories (titles must LEAD with the IMPACT subject, not the policy):
- sectors: Start with the public/private sector affected, then the specific effect.
  - EX: "Public parks get 15% less funding in 2028"
  - Bad: "New funding cuts affect public parks in 2028"
- demographics: Start with the demographic affected (income/race/age/etc.), then the effect.
  - EX: "Low-income households will struggle with SNAP benefits due to new restrictions"
  - Bad: "New SNAP restrictions will hurt low-income households"
- regions: Start with the region/area (state/city/rural/etc.), then the effect; region must appear in the title.
  - EX: "Rural counties in Texas face delayed broadband buildouts through 2027"
- aftermath: Start with the projected result (e.g., "CBO projects ..."), then what drives it.
  - EX: "CBO projects bill will increase deficit by $3.4 trillion"
If you cannot satisfy the above rule for a given impact category from the bill text, SKIP that card.

Classification fields (MANDATORY for each card):
- scope: Classify the scope of the change:
  - "entire_program" – clearly changes the core program/benefit structure.
  - "subprogram" – applies to a named sub-program (e.g. "Workforce Pell Grants").
  - "subsection" – narrow technical or funding change within a section.
  - "technical" – conforming/clerical/definitions with minor effect.
- number_type: Classify what type of number/amount is being changed:
  - "benefit_formula" – explicitly changes per-person amounts/eligibility (e.g. "maximum Federal Pell Grant amount").
  - "appropriation_cap" – sets/changes authorized or appropriated total amounts.
  - "shortfall_reserve" – sets/changes a reserve/shortfall line.
  - "penalty" – fines, penalties, fees.
  - "other" – everything else.
If you are unsure, choose the most cautious value (e.g., "subsection", "other").

Output JSON:
{"cards":[
  {"title":"...","subtext":"...","category":"action|scope|process|exceptions|sectors|demographics|regions|aftermath","scope":"entire_program|subprogram|subsection|technical","number_type":"benefit_formula|appropriation_cap|shortfall_reserve|penalty|other"},
  ...
]}
`.trim();
}

function makeUserPrompt(billName: string, section: number, chunkIndex: number, totalChunks: number, wantMax: number, pageText: string) {
  return `
BILL: ${billName}
SECTION: ${section}
CHUNK: ${chunkIndex + 1} / ${totalChunks}
MAX_CARDS_HINT: ${Math.max(5, wantMax)}

Before you add a card, checklist:
(1) Material change/impact present?
(2) Actor → Action → Target clearly stated?
(3) IMPACT titles lead with the impact subject (sector/demographic/region/aftermath) — NOT the policy action.
(4) Not a heading/boilerplate?
(5) If this text is about appropriations, shortfalls, or reserves, describe changes as funding for this section or specific program line, not as total program funding or per-person benefits unless the text clearly defines or changes those.
If any are false, OMIT the card.

PAGE TEXT (use ONLY this text):
"""${pageText}"""
`.trim();
}

async function mistralOnce(user: string, temperature = 0.2): Promise<RawCard[]> {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: MODEL_ID,
      temperature,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: makeSystemPrompt() },
        { role: "user",   content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Mistral HTTP ${r.status}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  console.warn("mistral reply", { content_len: (content || "").length });
  let parsed: any = {};
  try { parsed = JSON.parse(content); }
  catch {
    const i0 = content.indexOf("{"), i1 = content.lastIndexOf("}");
    if (i0 >= 0 && i1 > i0) { try { parsed = JSON.parse(content.slice(i0, i1 + 1)); } catch {} }
  }
  const arr = Array.isArray(parsed?.cards) ? parsed.cards : [];
  return arr.map((c: any) => ({
    title: trim(c?.title),
    subtext: trim(c?.subtext),
    category: trim(c?.category),
    scope: trim(c?.scope),
    number_type: trim(c?.number_type),
  }));
}

/** ============ INSERT (enhanced de-dupe: slug + near-duplicate) ============ */
async function insertCards(opts: {
  ownerId: number;
  part: number;
  billLink: string;
  billWebKey: string;
  webId: number;
  rawCards: RawCard[];
}) {
  if (!opts.rawCards?.length) return { inserted: 0, details: [] as any[] };

  // 0A) Fetch existing (title, subtext) for this section (legacy guard)
  const { data: existingRows, error: existErr } = await supabase
    .from("card_index")
    .select("title, subtext")
    .eq("owner_id", opts.ownerId)
    .eq("is_ppl", false)
    .eq("bill_section", opts.part);
  if (existErr) console.warn("fetch existing for dedupe failed", existErr);

  const existingKeys = new Set<string>();
  (existingRows || []).forEach((r: any) => {
    if (!r) return;
    existingKeys.add(normalizeKey(String(r.title || ""), String(r.subtext || "")));
  });

  // 0B) Global slug list (borrowed from bill coverage flow)
  const { data: existingAll, error: exAllErr } = await supabase
    .from("card_index")
    .select("slug")
    .eq("owner_id", opts.ownerId)
    .eq("is_ppl", false);
  if (exAllErr) console.warn("fetch existing slugs failed", exAllErr);
  const existingSlugs = new Set<string>((existingAll || []).map((r: any) => String(r.slug || "")));

  // 0C) Funding safety filter (before normalization)
  const safeRawCards = opts.rawCards.filter((rc) => {
    const t = trim(rc.title);
    const s = trim(rc.subtext);
    return isFundingCardSafe(rc, t, s);
  });

  // Log dropped funding cards
  if (safeRawCards.length < opts.rawCards.length) {
    console.warn("funding_safety_filter_dropped", {
      ownerId: opts.ownerId,
      part: opts.part,
      before: opts.rawCards.length,
      after: safeRawCards.length,
    });
  }

  // 1) Normalize + map category + tag titles (skip tag for impact to keep impact-first)
  type ReadyRow = {
    owner_id: number;
    created_at: string;
    title: string;
    subtext: string;
    screen: "agenda_legi" | "impact";
    category: string;
    score: number;
    is_media: boolean;
    link: string | null;
    is_active: boolean;
    web: string;
    web_id: number;
    is_ppl: boolean;
    bill_section: number;
    slug: string;
  };

  const normalized: ReadyRow[] = safeRawCards.map((rc) => {
    const mapped = canonicalizeCategory(rc.category);
    const norm = normalizeTitleSubtext(rc.title, rc.subtext);
    const titled = addTitleTagsIfConfigured(norm.title, mapped.category, mapped.screen);
    const slug = slugify(`${mapped.screen}:${mapped.category}:${titled}`);
    return {
      owner_id: opts.ownerId,
      created_at: new Date().toISOString(),
      title: titled,
      subtext: norm.subtext,
      screen: mapped.screen,
      category: mapped.category,
      score: 50,           // (scoring not changed here per request)
      is_media: false,
      link: opts.billLink || null,
      is_active: true,
      web: opts.billWebKey,
      web_id: opts.webId,
      is_ppl: false,
      bill_section: opts.part,
      slug,
    };
  });

  // 2) Rubric filter (policy materiality etc.)
  const filteredByRubric = normalized.filter((row) => isHighValueCard(row.title, row.subtext));
  if (!filteredByRubric.length) return { inserted: 0, details: [] };

  // 2.5) Impact style guardrails
  const filtered = filteredByRubric.filter((row) => {
    if (row.screen !== "impact") return true;
    return impactStyleOk(row.category, row.title, row.subtext);
  });
  if (!filtered.length) return { inserted: 0, details: [] };

  // 3) Enhanced de-dupe:
  //    - A) Against existing exact (title+subtext) keys
  //    - B) Against existing slugs (global for owner)
  //    - C) Within-batch per (screen,category) near-duplicate by title similarity >= 0.9
  const seenKeys = new Set(existingKeys);
  const seenSlugs = new Set(existingSlugs);
  const perCatKept: Record<string, { title: string; slug: string }[]> = {};
  const batch: ReadyRow[] = [];

  for (const row of filtered) {
    const key = normalizeKey(row.title, row.subtext);
    if (seenKeys.has(key)) continue;

    if (seenSlugs.has(row.slug)) continue;

    const catKey = `${row.screen}:${row.category}`;
    const list = perCatKept[catKey] || [];
    const isNearDup = list.some(x => titleSimilarity(x.title, row.title) >= 0.9);
    if (isNearDup) continue;

    // accept
    batch.push(row);
    seenKeys.add(key);
    seenSlugs.add(row.slug);
    (perCatKept[catKey] ||= []).push({ title: row.title, slug: row.slug });
  }

  if (!batch.length) return { inserted: 0, details: [] };

  // 4) Soft cap before insert
  const capped = batch.slice(0, SOFT_MAX_CARDS);

  // 5) Insert
  const { data: inserted, error: insErr } = await supabase
    .from("card_index")
    .insert(capped)
    .select("id");
  if (insErr) throw insErr;

  return { inserted: inserted.length, details: inserted };
}

/** ========================== MAIN ========================== */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });
    const id = await readId(req);

    // (1) Bill row
    const bill = await fetchLegiRow(id);

    // (2) Parts
    const parts = await listBillParts(id);
    if (!parts.length) return json(404, { error: "No bill parts found for this id.", id });

    // (3) Pick target part: first with no cards; else first > scanned
    const used = await fetchUsedSections(id);
    let target = parts.find(p => !used.has(p.part)) || null;

    const scanned = Number.isFinite(+bill.scanned) ? Number(bill.scanned) : 0;
    if (!target) {
      target = parts.find(p => p.part > scanned) || null;
    }
    if (!target) {
      return json(200, {
        id,
        processed_web_ids: [],
        inserted: 0,
        files_scanned: 0,
        details: [],
        remaining_parts: 0,
        notes: "All parts already scanned or already have cards.",
      });
    }

    // (4) Read text & chunk
    const partText = await readFileText(target.path);
    const chunks = makeChunks(partText);
    const totalChunks = chunks.length;

    // (5) First wave: parallel samples per chunk (scaled by slider)
    const tasksWave1: { user: string; temp: number }[] = [];
    for (let ci = 0; ci < totalChunks; ci++) {
      const user = makeUserPrompt(bill.name, target.part, ci, totalChunks, SOFT_MAX_CARDS, chunks[ci]);
      for (let k = 0; k < SAMPLES_PER_CHUNK_1; k++) {
        const temp = k === 0 ? 0.2 : 0.35; // light diversity
        tasksWave1.push({ user, temp });
      }
    }

    const results1 = await runLimited(tasksWave1, PARALLEL_REQUESTS, (task) =>
      mistralOnce(task.user, task.temp)
    );
    const allCards1 = results1.flat().filter(Boolean) as RawCard[];

    let totalInserted = 0;
    if (allCards1.length) {
      const res1 = await insertCards({
        ownerId: id,
        part: target.part,
        billLink: target.link,
        billWebKey: target.path,
        webId: target.web_id,
        rawCards: allCards1,
      });
      totalInserted += res1.inserted;
    }

    // (6) Second wave if needed (< PASS_MIN_CARDS) — scaled by slider
    if (totalInserted < PASS_MIN_CARDS) {
      const tasksWave2: { user: string; temp: number }[] = [];
      for (let ci = 0; ci < totalChunks; ci++) {
        const user = makeUserPrompt(bill.name, target.part, ci, totalChunks, SOFT_MAX_CARDS, chunks[ci]);
        for (let k = 0; k < SAMPLES_PER_CHUNK_2; k++) {
          const temp = 0.4; // slightly more exploration
          tasksWave2.push({ user, temp });
        }
      }
      const results2 = await runLimited(tasksWave2, PARALLEL_REQUESTS, (task) =>
        mistralOnce(task.user, task.temp)
      );
      const allCards2 = results2.flat().filter(Boolean) as RawCard[];
      if (allCards2.length) {
        const res2 = await insertCards({
          ownerId: id,
          part: target.part,
          billLink: target.link,
          billWebKey: target.path,
          webId: target.web_id,
          rawCards: allCards2,
        });
        totalInserted += res2.inserted;
      }
    }

    // (6.5) Mark the web_content row as used=true if we created any cards
    let markedUsed = false;
    if (totalInserted > 0) {
      const { error: usedErr } = await supabase
        .from("web_content")
        .update({ used: true })
        .eq("id", target.web_id);
      if (usedErr) {
        console.warn("web_content.used update failed", usedErr);
      } else {
        markedUsed = true;
      }
    }

    // (7) Update scanned progress
    const newScanned = Math.max(scanned, target.part);
    if (newScanned !== scanned) {
      const { error: upErr } = await supabase.from("legi_index").update({ scanned: newScanned }).eq("id", id);
      if (upErr) console.warn("scanned update failed", upErr);
    }

    // (8) Remaining parts with no cards
    const usedAfter = await fetchUsedSections(id);
    const remaining = parts.filter(p => !usedAfter.has(p.part)).length;

    const elapsed = Date.now() - t0;

    // ===== Tiny-profile mode signal when no cards were inserted =====
    if (totalInserted === 0) {
      return json(200, {
        id,
        processed_web_ids: [target.web_id],
        inserted: 0,
        files_scanned: 1,
        details: [{
          web_id: target.web_id,
          web: target.path,
          bill_section: target.part,
          generated: 0,
          chunks: totalChunks,
          wave1_calls: tasksWave1.length,
          wave2_calls: chunks.length * SAMPLES_PER_CHUNK_2,
          runtime_ms: elapsed,
          web_content_used_marked: false
        }],
        remaining_parts: remaining,
        status: "low_materiality",
        reason: "no_material_cards_after_rubric",
        suggest_ui: {
          collapse_pages: ["agenda_legi", "impact", "media"],
          show_synopsis_link: true,
          congress_link: target.link || null
        }
      });
    }

    // Normal success path
    return json(200, {
      id,
      processed_web_ids: [target.web_id],
      inserted: totalInserted,
      files_scanned: 1,
      details: [{
        web_id: target.web_id,
        web: target.path,
        bill_section: target.part,
        generated: totalInserted,
        chunks: totalChunks,
        wave1_calls: tasksWave1.length,
        wave2_calls: totalInserted < PASS_MIN_CARDS ? (chunks.length * SAMPLES_PER_CHUNK_2) : 0,
        runtime_ms: elapsed,
        web_content_used_marked: markedUsed
      }],
      remaining_parts: remaining,
      // Expose runtime tuning for observability
      tuning: {
        CARD_GEN_INTENSITY: CONCURRENCY_SLIDER,
        PARALLEL_REQUESTS,
        SAMPLES_PER_CHUNK_1,
        SAMPLES_PER_CHUNK_2,
        MAX_OUTPUT_TOKENS
      }
    });
  } catch (e: any) {
    console.error(e);
    return json(500, { error: String(e?.message || e || "unknown error") });
  }
});
