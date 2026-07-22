/**
 * Shared LLM link-type/quality judge + domain-trust classification.
 *
 * ppl_round1 and ppl_round2 both judge unknown domains and both write the
 * result to `domain_judgments`, where it is cached and trusted outright for
 * every later page on that domain. They previously carried byte-identical
 * copies of this logic, which is how a classification bug shipped twice; the
 * logic lives here now so there is exactly one copy to reason about.
 */

export type LlmTypeVerdict = {
  verdict: "allow" | "block";
  score: number; // 0..10
  institution:
    | "federal_gov" | "state_gov" | "local_gov" | "congress" | "committee" | "court" | "agency"
    | "edu" | "research_lab" | "hospital" | "media" | "think_tank" | "ngo"
    | "party" | "campaign" | "advocacy" | "unknown";
  official_affiliation: boolean;
  partisanship: "nonpartisan" | "mixed_official" | "partisan" | "unknown";
  reliability_signals: {
    publisher_identified: boolean;
    date_present: boolean;
    citations_or_primary_docs: boolean;
    byline_or_ownership: boolean;
  };
  content_flags: {
    press_release: boolean;
    news_clip_or_blog_rollup: boolean;
    opinion_or_editorial: boolean;
    thin_or_mostly_video: boolean;
  };
  recency_ok: boolean;
  subdomain_affiliation_ok: boolean;
  reasons: string[];
};

export const _SYSTEM = `
You are a rigorous link-type and quality gate for a civic app. Judge ONLY the provided metadata and page snippet. Do not use outside knowledge. Follow the rules exactly and return strict JSON.

Rules:
- Allow official gov/edu/research/hospital sources; verify affiliation and subdomain.
- Allow Congress/committees only for neutral documents (bills, schedules, transcripts, roll calls).
- Exclude: press releases, news clips/blog rollups, opinion/editorials — even on official sites.
- All sources must be <= 12 months old (recency_ok must be true), otherwise block.
- Media outlets, think tanks and NGOs are eligible when factual and transparent; a point of view alone is not a block, but propaganda for a party, campaign or movement is blocked.
- Hospitals/health orgs allowed with factuality/quality checks.
- If the page is campaign/party/party-committee propaganda, block.

Field rules:
- "institution" must be exactly one of: federal_gov, state_gov, local_gov, congress, committee, court, agency, edu, research_lab, hospital, media, think_tank, ngo, party, campaign, advocacy, unknown. Never put an organization's name here — a named think tank is "think_tank", a named outlet is "media". Use "unknown" if none fit.
- "partisanship" must be exactly one of: nonpartisan, mixed_official, partisan, unknown. Use "partisan" only when the source itself is aligned with a party, campaign or political movement. Use "nonpartisan" for neutral sources, including think tanks, universities and research organizations that are not aligned with a party. Use "mixed_official" for an official government source that also carries political messaging. Use "unknown" only when the snippet genuinely does not say. Never write any other value and never describe partisanship in prose in this field.
- "reasons" is free-text explanation only. It is never parsed for classification, so every judgment you want applied must appear in the structured fields above.
- Output valid JSON only, no commentary.
`;

export function _userPrompt(args: {
  nowIso: string;
  person?: string;
  topic?: string;
  state?: string;
  meta: { url: string; host: string; title?: string; detected_date?: string | null; lang?: string | null };
  snippet: string;
}) {
  const { nowIso, person = "", topic = "", state = "", meta, snippet } = args;
  return `
REQUEST_CONTEXT = { "person": "${person}", "topic": "${topic}", "state": "${state}", "now_iso": "${nowIso}" }
PAGE_META = ${JSON.stringify(meta)}
PAGE_SNIPPET = """${snippet.slice(0, 4000)}"""
Return JSON with keys: verdict, score, institution, official_affiliation, partisanship, reliability_signals, content_flags, recency_ok, subdomain_affiliation_ok, reasons.
`.trim();
}

/** ---------------- structured-field normalization ----------------
 * The model does not reliably stick to the declared enums: production rows
 * carry partisanship values like "left-leaning", "high", "neutral" and "".
 * These are matched as whole normalized tokens against a closed vocabulary --
 * never as substrings, because substring matching is what made "non-partisan"
 * and "no partisan affiliation" read as partisan and blocked CBO, GAO, court
 * opinions, Pew and Brookings. Anything outside the vocabulary is "ambiguous"
 * and gets re-asked, not guessed at. */

function normToken(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const PARTISAN_TOKENS = new Set([
  "partisan", "highlypartisan", "stronglypartisan", "verypartisan", "moderatelypartisan",
  "partisanleaning", "leaning", "left", "right", "leftleaning", "rightleaning",
  "leaningleft", "leaningright", "liberal", "conservative", "progressive",
  "biased", "high", "strong", "yes", "true", "party", "partyaligned", "campaignaligned",
]);

const NONPARTISAN_TOKENS = new Set([
  "nonpartisan", "notpartisan", "nonpartisanship", "neutral", "impartial", "objective",
  "balanced", "none", "no", "false", "low", "na", "notapplicable", "independent",
]);

const MIXED_OFFICIAL_TOKENS = new Set(["mixedofficial", "mixed", "official"]);

export type PartisanshipClass = "partisan" | "nonpartisan" | "mixed_official" | "ambiguous";

/** Classify the structured partisanship field alone. Free text is never read. */
export function classifyPartisanship(raw: unknown): PartisanshipClass {
  const t = normToken(raw);
  if (!t) return "ambiguous";
  if (PARTISAN_TOKENS.has(t)) return "partisan";
  if (NONPARTISAN_TOKENS.has(t)) return "nonpartisan";
  if (MIXED_OFFICIAL_TOKENS.has(t)) return "mixed_official";
  return "ambiguous"; // includes "unknown", "medium", "moderate", prose, anything unlisted
}

const INSTITUTION_ENUM = new Set([
  "federal_gov", "state_gov", "local_gov", "congress", "committee", "court", "agency",
  "edu", "research_lab", "hospital", "media", "think_tank", "ngo",
  "party", "campaign", "advocacy", "unknown",
]);

/** Map the institution field onto the enum; an org name (e.g. "Center for
 * American Progress") is not an enum member and normalizes to "unknown"
 * rather than being keyword-scanned. */
export function classifyInstitution(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return INSTITUTION_ENUM.has(s) ? s : "unknown";
}

const OFFICIAL_INSTITUTIONS = new Set([
  "federal_gov", "state_gov", "local_gov", "congress", "committee", "court", "agency",
  "edu", "research_lab", "hospital",
]);

const PARTISAN_INSTITUTIONS = new Set(["party", "campaign", "advocacy"]);

export type DomainTrust = {
  institution: string;
  partisanship: PartisanshipClass;
  isOfficial: boolean;
  isPartisan: boolean;
  affiliationOk: boolean;
  /** True when the model's block is fully explained by page-level facts. */
  pageLevelBlockOnly: boolean;
  /** Undecidable from this verdict -- caller must re-ask and must not cache. */
  ambiguous: boolean;
  trustworthy: boolean;
};

/**
 * Domain-level trust: institution + partisanship + affiliation, which are
 * stable across pages, so this is what gets persisted to `domain_judgments`.
 *
 * The model's own `verdict` is page-level -- it folds in recency and content
 * type. Letting it veto domain trust meant one stale article permanently
 * blacklisted the whole domain (brookings.edu was blocked over a 2017 page).
 * A block is therefore only held against the domain when page-level facts
 * (staleness, press release / opinion / news clip) do not already explain it.
 */
export function assessDomainTrust(v: LlmTypeVerdict): DomainTrust {
  const institution = classifyInstitution(v.institution);
  const partisanship = classifyPartisanship(v.partisanship);
  const isOfficial = OFFICIAL_INSTITUTIONS.has(institution);
  const isPartisan = PARTISAN_INSTITUTIONS.has(institution) || partisanship === "partisan";
  const affiliationOk = !isOfficial || Boolean(v.official_affiliation && v.subdomain_affiliation_ok);

  const flags = v.content_flags ?? ({} as LlmTypeVerdict["content_flags"]);
  const pageLevelBlockOnly =
    v.recency_ok === false ||
    Boolean(flags.press_release || flags.news_clip_or_blog_rollup || flags.opinion_or_editorial);

  const ambiguous = partisanship === "ambiguous";
  const domainVerdictOk = v.verdict === "allow" || pageLevelBlockOnly;
  const trustworthy = !ambiguous && !isPartisan && affiliationOk && domainVerdictOk;

  return { institution, partisanship, isOfficial, isPartisan, affiliationOk, pageLevelBlockOnly, ambiguous, trustworthy };
}

/** ---------------- Mistral judge calls ---------------- */

export function _safeParseVerdict(s: string): LlmTypeVerdict | null {
  try {
    const jsonStart = s.indexOf("{");
    const jsonEnd = s.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(s.slice(jsonStart, jsonEnd + 1));
    if (typeof parsed?.verdict !== "string" || typeof parsed?.score !== "number") return null;
    return parsed as LlmTypeVerdict;
  } catch {
    return null;
  }
}

const MISTRAL_URL = () => Deno.env.get("MISTRAL_API_URL") ?? "https://api.mistral.ai/v1/chat/completions";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry-After is seconds or an HTTP date; cap the wait so one 429 can't eat the run budget. */
function retryAfterMs(r: Response): number {
  const h = r.headers.get("retry-after");
  if (!h) return 0;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.min(Math.max(secs, 0) * 1000, 2000);
  const when = Date.parse(h);
  if (!Number.isNaN(when)) return Math.min(Math.max(when - Date.now(), 0), 2000);
  return 0;
}

async function mistralCall(body: unknown, timeoutMs: number): Promise<{ ok: true; text: string } | { ok: false; retryable: boolean; waitMs: number }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(MISTRAL_URL(), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("MISTRAL_API_KEY")!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) {
      // 429/5xx are transient; a non-2xx used to return null outright, which
      // cached nothing and dropped the page as if the judge had refused it.
      const retryable = r.status === 429 || r.status === 408 || r.status >= 500;
      const waitMs = retryAfterMs(r);
      try { await r.body?.cancel(); } catch { /* ignore */ }
      return { ok: false, retryable, waitMs };
    }
    const j = await r.json();
    return { ok: true, text: j?.choices?.[0]?.message?.content ?? "" };
  } catch {
    return { ok: false, retryable: true, waitMs: 0 }; // timeout / network
  } finally {
    clearTimeout(t);
  }
}

// Measured: a real judge call (full system prompt + 4000-char snippet + this
// schema's structured JSON output) reliably takes ~1.5s. Caching means this
// runs once per domain ever, not once per page, so generous timeouts here are
// a one-time cost.
const JUDGE_TIMEOUTS_MS = [5000, 6000, 6000];

export async function _mistralJudgeSmall(input: {
  meta: { url: string; host: string; title?: string; detected_date?: string | null; lang?: string | null };
  snippet: string;
  person?: string; topic?: string; state?: string;
  nowIso: string;
}): Promise<LlmTypeVerdict | null> {
  const body = {
    model: "mistral-small-latest",
    temperature: 0,
    max_tokens: 256,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: _SYSTEM },
      { role: "user", content: _userPrompt({ ...input }) },
    ],
  };

  for (let attempt = 0; attempt < JUDGE_TIMEOUTS_MS.length; attempt++) {
    const res = await mistralCall(body, JUDGE_TIMEOUTS_MS[attempt]);
    if (res.ok) {
      const parsed = _safeParseVerdict(res.text);
      if (parsed) return parsed;
      continue; // unparseable body: worth one more shot
    }
    if (!res.retryable) return null;
    if (attempt < JUDGE_TIMEOUTS_MS.length - 1) await sleep(Math.max(res.waitMs, 300 * (attempt + 1)));
  }
  return null;
}

/**
 * Re-ask for the partisanship field alone when the first answer wasn't one of
 * the enum values. Cheaper and more reliable than guessing from prose -- and
 * if this still comes back ambiguous the caller declines to cache anything.
 */
export async function _clarifyPartisanship(input: {
  meta: { url: string; host: string };
  snippet: string;
  priorAnswer: unknown;
}): Promise<PartisanshipClass> {
  const body = {
    model: "mistral-small-latest",
    temperature: 0,
    max_tokens: 32,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `Classify the partisanship of a web source. Return ONLY {"partisanship": "<value>"} where <value> is exactly one of: nonpartisan, mixed_official, partisan.\n` +
          `- "partisan": the source is aligned with a political party, campaign or movement.\n` +
          `- "mixed_official": an official government source that also carries political messaging.\n` +
          `- "nonpartisan": everything else, including think tanks, universities, research bodies, courts and agencies that are not party-aligned.\n` +
          `Judge the source itself, not the topic it covers. You must pick one of the three values.`,
      },
      {
        role: "user",
        content: `HOST = ${input.meta.host}\nURL = ${input.meta.url}\nPREVIOUS_UNCLEAR_ANSWER = ${JSON.stringify(String(input.priorAnswer ?? ""))}\nPAGE_SNIPPET = """${input.snippet.slice(0, 1500)}"""`,
      },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await mistralCall(body, 5000);
    if (res.ok) {
      try {
        const start = res.text.indexOf("{");
        const end = res.text.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          const cls = classifyPartisanship(JSON.parse(res.text.slice(start, end + 1))?.partisanship);
          if (cls !== "ambiguous") return cls;
        }
      } catch { /* fall through to retry */ }
      continue;
    }
    if (!res.retryable) break;
    await sleep(300);
  }
  return "ambiguous";
}
