/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web"; // unused here

/** ========= CONCURRENCY SLIDER (Adjust this) =========
 * Controls parallel URL probing within each search.
 * URLs are now processed fully in parallel (no batching).
 */
const SLIDER_DEFAULT = 12; // Increased default for better performance
const CONCURRENCY = (() => {
  const fromEnv = Number(Deno.env.get("METRICS_CONCURRENCY"));
  const raw = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : SLIDER_DEFAULT;
  return Math.max(1, Math.min(12, Math.floor(raw)));
})();

/** Runtime budgets tuned to avoid edge OOMs */
const GLOBAL_TIMEOUT_MS = 25_000;  // global wall-clock cap
const EXTRACT_TIMEOUT_MS = 12_000; // per-extract timeout
const LLM_TIMEOUT_MS = 10_000;     // per-LLM call timeout

/** Search/scan limits */
const MAX_RESULTS_PER_SEARCH = 3;   // only 3 links per search
const ATTEMPT_BUDGET = 3;           // try at most 3 URLs per search (sequential)

/** Text size limits (keep heap < ~160MB) */
const MAX_SCAN_LEN = 120_000;           // total text we keep from a page
const CENTRALITY_MAX_CHARS = 110_000;   // amount passed to centrality gate
const PART_LEN = 60_000;
const METRIC_PARTS_CAP = 2;
const MISTRAL_INPUT_SLICE = 30_000;

const POLL_MAX_AGE_DAYS = 31;
const TAVILY_SEARCH_DEPTH = "basic";

/** ========================== CLIENT ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function nowIso() { return new Date().toISOString(); }
function daysBetweenUTC(aISO: string, bISO: string): number {
  const a = Date.parse(aISO);
  const b = Date.parse(bISO);
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}
function recencyOk(date_ymd: string | null): boolean {
  if (!date_ymd) return false;
  const diff = daysBetweenUTC(new Date(date_ymd).toISOString(), nowIso());
  return diff <= POLL_MAX_AGE_DAYS;
}

async function readId(req: Request): Promise<number> {
  const url = new URL(req.url);
  const qId = url.searchParams.get("id");
  if (qId && /^\d+$/.test(qId)) return Number(qId);

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (j && typeof j.id === "number") return j.id;
    if (j && typeof j.id === "string" && /^\d+$/.test(j.id)) return Number(j.id);
  } else {
    const raw = await req.text();
    if (raw && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  }
  throw new Error("Missing or invalid id. Provide as JSON { id }, query ?id=, or raw numeric body.");
}

function hostOf(u: string): string { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } }

/** Abortable fetch helper */
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs, ...rest } = init;
  const controller = new AbortController();
  const t = timeoutMs ? setTimeout(() => controller.abort("timeout"), timeoutMs) : null;
  try {
    const r = await fetch(input, { ...rest, signal: controller.signal });
    return r;
  } finally {
    if (t) clearTimeout(t);
  }
}

/** ========================== TAVILY ========================== */
async function tavilySearch(query: string, max = MAX_RESULTS_PER_SEARCH): Promise<string[]> {
  const body: any = {
    api_key: TAVILY_API_KEY,
    query,
    max_results: max,
    search_depth: TAVILY_SEARCH_DEPTH,
  };
  const r = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 10_000,
  });
  if (!r || !r.ok) throw new Error(`Tavily search error ${r?.status}`);
  const j = await r.json();
  const list = j?.results || j?.data || [];
  return list.map((x: any) => String(x?.url || "")).filter(Boolean).slice(0, MAX_RESULTS_PER_SEARCH);
}

async function tavilyExtract(url: string): Promise<string> {
  const r = await fetchWithTimeout("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_API_KEY, urls: [url], format: "markdown" }),
    timeoutMs: EXTRACT_TIMEOUT_MS,
  });
  if (!r || !r.ok) throw new Error(`Tavily extract error ${r?.status}`);
  const j = await r.json();
  const res = j?.results?.[0] ?? {};
  const content =
    (typeof res.markdown === "string" && res.markdown) ||
    (typeof res.content === "string" && res.content) ||
    (typeof res.raw_content === "string" && res.raw_content) || "";
  if (!content.trim()) throw new Error("empty extract");
  return content.length > MAX_SCAN_LEN ? content.slice(0, MAX_SCAN_LEN) : content;
}

/** ========================== MISTRAL ========================== */
async function mistralJSON(system: string, user: string, max_tokens = 600): Promise<any> {
  const r = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      temperature: 0.0,
      response_format: { type: "json_object" },
      max_tokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    timeoutMs: LLM_TIMEOUT_MS,
  });
  if (!r || !r.ok) throw new Error(`Mistral error ${r?.status}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

/** ========================== RANKING HELPERS ========================== */
function extractYearsFromUrl(url: string): number[] {
  const out: number[] = [];
  try {
    const path = new URL(url).pathname.toLowerCase();
    for (const m of path.matchAll(/\b(19|20)\d{2}\b/g)) out.push(Number(m[0]));
  } catch {}
  return out;
}
function hasYearInParens(url: string): boolean {
  try { return /\((?:[^()]*?(19|20)\d{2}[^()]*)\)/.test(new URL(url).pathname); } catch { return false; }
}
function rankFreshnessGeneric(url: string): number {
  let s = 100;
  const nowYear = new Date().getUTCFullYear();
  const years = extractYearsFromUrl(url);
  const pathLen = (() => { try { return new URL(url).pathname.split("/").filter(Boolean).length; } catch { return 0; } })();

  for (const y of years) {
    if (y <= nowYear - 2) s -= 35;
    else if (y === nowYear - 1) s -= 10;
    else if (y >= nowYear) s += 5;
  }
  if (hasYearInParens(url)) s -= 25;
  s -= Math.min(20, Math.floor(pathLen / 2));
  return s;
}
function rankUrls(urls: string[]): string[] {
  return urls.map(u => ({ u, s: rankFreshnessGeneric(u) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.u)
    .slice(0, ATTEMPT_BUDGET);
}

/** ========================== CENTRALITY CHECK ========================== */
async function isPageAboutPersonApproval(person: string, pageText: string): Promise<boolean> {
  const sys = "Return JSON {\"about\": true|false}. Be strict.";
  const usr = `
PERSON: ${person}
TEXT (up to ~${CENTRALITY_MAX_CHARS} chars):
"""${pageText.slice(0, CENTRALITY_MAX_CHARS)}"""

Is ${person} a primary subject of approval/favorability/disapproval numbers here OR of their election vote totals?
Respond strictly as {"about": true|false}.`.trim();
  try {
    const j = await mistralJSON(sys, usr, 40);
    return Boolean(j?.about === true);
  } catch {
    return false;
  }
}

/** ========================== NUMBER NORMALIZATION ========================== */
// Robust numeric parser: number -> int; "203,000" -> 203000; other -> null
function parseIntish(x: any): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return Math.round(x);
  if (typeof x === "string") {
    const s = x.replace(/[\s,._]/g, ""); // strip common separators
    if (/^-?\d+$/.test(s)) return Math.round(Number(s));
  }
  return null;
}

/** ========================== UNIVERSE-AWARE PARSER ========================== */
type Universe = "likely_voters" | "registered_voters" | "adults" | "other" | "party_subset";
function universeScore(u: Universe): number {
  switch (u) {
    case "likely_voters": return 5;
    case "registered_voters": return 4;
    case "adults": return 3;
    case "other": return 2;
    case "party_subset": return 1;
    default: return 0;
  }
}

type PollCand = {
  approval: number | null;
  disapproval: number | null;
  votes: number | null;
  context_label: string;
  date_ymd: string | null;
  confidence: number;
  universe: Universe;
  sample_n: number | null;
  subgroup_label: string | null;
};

async function mistralExtractMetrics(fullName: string, part: string, mode: "polls" | "votes", widen: boolean): Promise<PollCand> {
  const sys = `You are a strict data extractor. Return ONLY JSON. No guesses.`;
  const usr = `
POLITICIAN: ${fullName}
MODE: ${mode}
WIDE_SCAN: ${widen ? "true" : "false"}

TEXT (markdown, truncated):
"""${part.slice(0, MISTRAL_INPUT_SLICE)}"""

Extract strictly as JSON with DIGIT-ONLY integers (no words, no percentages, no ranges).
If a value is not available AS DIGITS, return null.

{
  "approval": <integer or null>,   // e.g., 42 (NOT "42%" and NOT "forty-two")
  "disapproval": <integer or null>,
  "votes": <integer or null>,      // e.g., 203000 (NOT "203k", NOT "two hundred three thousand")
  "context_label": "<short phrase e.g., 'national RV', 'General election (2022)'>",
  "date_ymd": "<YYYY-MM-DD or null>",
  "confidence": 0..1,
  "universe": "<one of: likely_voters | registered_voters | adults | other | party_subset>",
  "sample_n": <integer or null>,
  "subgroup_label": "<e.g., Republicans, Democrats, Independents, null if general>"
}

Rules:
- Votes must be the named person's TOTAL VOTE COUNT (not seat counts, not number of candidates).
- If multiple polls/numbers appear, prefer approval/disapproval for the general electorate.
- Reject percentages for "votes"; only accept exact counts in digits.
- Do NOT fabricate dates or sample sizes.
`.trim();

  const j = await mistralJSON(sys, usr, 700);

  const normApproval = parseIntish(j?.approval);
  const normDisapproval = parseIntish(j?.disapproval);
  const normVotes = parseIntish(j?.votes);
  const normSample = parseIntish(j?.sample_n);

  const rawU = (j?.universe ?? "").toString().trim().toLowerCase();
  const normU: Universe = (["likely_voters","registered_voters","adults","other","party_subset"] as const).includes(rawU as Universe)
    ? (rawU as Universe)
    : "other";

  return {
    approval: normApproval,
    disapproval: normDisapproval,
    votes: normVotes,
    context_label: (j?.context_label ?? "").toString().trim(),
    date_ymd: (j?.date_ymd ?? "").toString().trim() || null,
    confidence: Math.max(0, Math.min(1, Number(j?.confidence ?? 0))),
    universe: normU,
    sample_n: normSample,
    subgroup_label: (j?.subgroup_label ?? null) ? String(j.subgroup_label) : null,
  };
}

/** Select best metrics with preference for general electorate over party subsets */
async function scanPageForMetrics(
  fullName: string,
  pageLimited: string,
  mode: "polls" | "votes",
  bigBias: boolean
) {
  const parts: string[] = [];
  for (let i = 0; i < pageLimited.length && parts.length < METRIC_PARTS_CAP; i += PART_LEN) {
    parts.push(pageLimited.slice(i, i + PART_LEN));
  }

  // OPTIMIZATION: Process all parts in parallel
  const partPromises = parts.map(async (p) => {
    let r = await mistralExtractMetrics(fullName, p, mode, false);

    // Widen if exactly one of approval/disapproval present & low confidence
    const hasOne = (r.approval != null) !== (r.disapproval != null);
    if (mode === "polls" && hasOne && r.confidence < 0.4) {
      try {
        const wide = await mistralExtractMetrics(fullName, p, mode, true);
        const wideSignal = (wide.approval != null || wide.disapproval != null);
        if (wideSignal && (wide.confidence > r.confidence)) r = wide;
      } catch {}
    }

    return r;
  });

  const allResults = await Promise.all(partPromises);
  let best: PollCand | null = null;

  // Now evaluate all results to find the best
  for (const r of allResults) {
    if (mode === "polls") {
      const hasAny = r.approval != null || r.disapproval != null;
      if (!hasAny) continue;

      // Heuristic scoring
      const recent = r.date_ymd ? (recencyOk(r.date_ymd) ? 1 : 0) : 0;
      const both = (r.approval != null && r.disapproval != null) ? 1 : 0;
      const uScore = universeScore(r.universe);
      const size = r.sample_n ?? 0;

      const universeWeight = bigBias ? 1.25 : 1.0;

      const score =
        (recent * 10) +
        (both * 4) +
        (uScore * 3 * universeWeight) +
        Math.min(3, Math.floor(size / 500)) +
        Math.round(r.confidence * 2);

      if (!best) { best = { ...r, confidence: r.confidence + score * 0.0001 }; continue; }

      const bRecent = best.date_ymd ? (recencyOk(best.date_ymd) ? 1 : 0) : 0;
      const bBoth = (best.approval != null && best.disapproval != null) ? 1 : 0;
      const bUScore = universeScore(best.universe);
      const bSize = best.sample_n ?? 0;
      const bScore =
        (bRecent * 10) +
        (bBoth * 4) +
        (bUScore * 3 * universeWeight) +
        Math.min(3, Math.floor(bSize / 500)) +
        Math.round(best.confidence * 2);

      if (score > bScore) best = r;
    } else {
      // Votes route: require a sensible vote count to avoid spurious tiny numbers
      if (!(r.votes != null && r.votes > 0)) continue;

      // Guard: treat suspiciously tiny vote counts as invalid (prevents "2", "12", etc.).
      // Adjust threshold if you need local races; for federal/statewide this is safe.
      if (r.votes < 1000) continue;

      if (!best) { best = r; continue; }
      const av = r.votes ?? 0, bv = best.votes ?? 0;
      if (av !== bv) { if (av > bv) best = r; continue; }
      const rRecent = r.date_ymd ? (recencyOk(r.date_ymd) ? 1 : 0) : 0;
      const bRecent = best.date_ymd ? (recencyOk(best.date_ymd) ? 1 : 0) : 0;
      if (rRecent > bRecent) { best = r; continue; }
      if (r.confidence > best.confidence) best = r;
    }
  }

  return best ?? {
    approval: null, disapproval: null, votes: null, context_label: "",
    date_ymd: null, confidence: 0, universe: "other", sample_n: null, subgroup_label: null
  };
}

/** ========================== SUMMARY WRITER ========================== */
async function makePollSummary(opts: {
  fullName: string;
  domain: string;
  link: string;
  excerpt: string; // 8k max
  approval: number | null;
  disapproval: number | null;
  votes: number | null;
  context_label: string;
  include_votes: boolean;
}) {
  // Focus ONLY on what exists; never mention missing data.
  const sys = `You are a precise political writer. Return JSON {"summary":"..."}.
- Keep it neutral (3–4 sentences).
- Focus ONLY on the numbers provided below and explain their context (poll universe/date/source, or election type/year for votes).
- Do NOT mention any missing or unavailable data.`;
  const usr = `
PERSON: ${opts.fullName}
SOURCE DOMAIN: ${opts.domain}
LINK: ${opts.link}
CONTEXT_LABEL: ${opts.context_label || "(unspecified)"}

NUMBERS TO DESCRIBE (ONLY talk about these):
- approval: ${opts.approval === null ? "null" : String(opts.approval)}
- disapproval: ${opts.disapproval === null ? "null" : String(opts.disapproval)}
- votes: ${opts.votes === null ? "null" : String(opts.votes)}

GUIDANCE:
- If approval/disapproval are non-null, describe that poll context (universe if present, any clear timing).
- Else if votes is non-null, describe it as an election vote total and include the election type/year if evident.
- End with: "Source: ${opts.domain}."

PAGE EXCERPT (grounding; do not quote verbatim):
"""${opts.excerpt.slice(0, 8000)}"""

Return JSON ONLY as {"summary": "..."}.
`.trim();

  try {
    const j = await mistralJSON(sys, usr, 400);
    return (j?.summary ?? "").toString().trim();
  } catch {
    return "";
  }
}

/** ========================== QUERY BUILDERS ========================== */
function buildGeneralElectorateQueries(fullName: string): string[] {
  const base = [
    `${fullName} approval disapproval latest poll among voters (national)`,
    `${fullName} approval disapproval among registered voters national poll`,
    `${fullName} approval disapproval among likely voters national`,
    `${fullName} favorability poll general electorate approval disapproval`,
    `${fullName} job approval among all voters nationwide`,
    `${fullName} approval rating national adults poll`,
    `${fullName} approval disapproval broad sample voters`,
    `${fullName} approval disapproval across electorate not just party`,
    `${fullName} approval and disapproval survey nationwide voters`,
    `${fullName} approval disapproval poll (registered voters OR likely voters OR adults)`,
  ];
  return base;
}
function buildPrimaryPollingQuerySet(fullName: string) {
  return { mode: "polls" as const, queries: buildGeneralElectorateQueries(fullName) };
}
function buildBallotpediaFallbackQuery(fullName: string) {
  return { mode: "votes" as const, queries: [`${fullName} ballotpedia`] };
}

/** ========================== PROBING HELPERS ========================== */
type ProbeResult = {
  url: string;
  excerpt: string;
  result: Awaited<ReturnType<typeof scanPageForMetrics>>;
} | null;

async function isBinaryOrHuge(url: string): Promise<boolean> {
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD", timeoutMs: 5_000 });
    const ctype = head?.headers?.get("content-type") || "";
    if (/(application\/pdf|image\/audio|video\/)/i.test(ctype)) return true;
    const clen = Number(head.headers.get("content-length") || "0");
    if (Number.isFinite(clen) && clen > 2_000_000) return true;
    return false;
  } catch { return false; }
}

async function probeOne(fullName: string, url: string, mode: "polls" | "votes", bigBias: boolean): Promise<ProbeResult> {
  try {
    if (await isBinaryOrHuge(url)) return null;
    const pageLimited = await tavilyExtract(url);

    // use up to 110k chars for centrality decision
    const centralityText = pageLimited.slice(0, CENTRALITY_MAX_CHARS);

    const isBallotpedia = hostOf(url) === "ballotpedia.org";
    
    // OPTIMIZATION: Run centrality check and metrics scan in parallel
    let aboutPromise: Promise<boolean>;
    if (mode === "votes" && isBallotpedia) {
      aboutPromise = Promise.resolve(true);
    } else {
      aboutPromise = isPageAboutPersonApproval(fullName, centralityText);
    }
    
    const parsedPromise = scanPageForMetrics(fullName, pageLimited, mode, bigBias);
    
    // Wait for both to complete
    const [about, parsed] = await Promise.all([aboutPromise, parsedPromise]);
    
    if (!about) return null;

    if (mode === "polls") {
      const hasAny = parsed.approval != null || parsed.disapproval != null;
      const recentOk = recencyOk(parsed.date_ymd);
      if (hasAny && (recentOk || parsed.date_ymd === null)) {
        return { url, excerpt: pageLimited.slice(0, 8000), result: parsed };
      }
      return null;
    } else {
      // votes route accepts pages with vote totals (guarded later for sensible magnitude)
      if (parsed.votes != null && parsed.votes > 0) {
        return { url, excerpt: pageLimited.slice(0, 8000), result: parsed };
      }
      return null;
    }
  } catch {
    return null;
  }
}

/** Try URLs fully in parallel (up to CONCURRENCY limit) for maximum speed */
async function tryCandidatesConcurrent(
  fullName: string,
  urls: string[],
  mode: "polls" | "votes",
  bigBias: boolean,
  requireBallotpediaHost = false
): Promise<ProbeResult> {
  const ranked = rankUrls(urls);
  const filtered = requireBallotpediaHost 
    ? ranked.filter(u => hostOf(u) === "ballotpedia.org")
    : ranked;
  
  if (!filtered.length) return null;
  
  // OPTIMIZATION: Process all URLs in parallel (up to CONCURRENCY limit), return first success
  const limited = filtered.slice(0, CONCURRENCY);
  const promises = limited.map(u => probeOne(fullName, u, mode, bigBias));
  const results = await Promise.allSettled(promises);
  
  // Return first successful result
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) return r.value;
  }
  
  return null;
}

/** ========================== CORE LOOKUP ========================== */
async function findMetricsForPerson(
  pplId: number,
  fullName: string,
  tier: string,
  prevProfile: any,
  globalDeadline: number
) {
  const expired = () => Date.now() >= globalDeadline;
  const bigBias = (tier || "").toLowerCase() === "hard";

  let selectedMode: "polls" | "votes" | null = null;
  let picked: ProbeResult = null;

  // If base tier, try Ballotpedia first (3 links, parallel, require ballotpedia.org)
  if ((tier || "").toLowerCase() === "base" && !expired()) {
    const ballot = buildBallotpediaFallbackQuery(fullName);
    let urls: string[] = [];
    try { urls = await tavilySearch(ballot.queries[0], MAX_RESULTS_PER_SEARCH); } catch {}
    if (urls.length) {
      picked = await tryCandidatesConcurrent(fullName, urls, ballot.mode, bigBias, /*requireBallotpediaHost*/ true);
      if (picked) selectedMode = ballot.mode;
    }
  }

  // PRIMARY: polling for ALL tiers (runs if not yet picked)
  // OPTIMIZATION: Try multiple queries in parallel, stop as soon as one succeeds
  if (!picked) {
    const primary = buildPrimaryPollingQuerySet(fullName);
    
    // Process queries in batches of 3 for balanced speed/resource usage
    const QUERY_BATCH_SIZE = 3;
    for (let i = 0; i < primary.queries.length && !picked && !expired(); i += QUERY_BATCH_SIZE) {
      const batchQueries = primary.queries.slice(i, i + QUERY_BATCH_SIZE);
      
      // Launch all searches in parallel
      const searchPromises = batchQueries.map(async (q) => {
        try {
          const urls = await tavilySearch(q, MAX_RESULTS_PER_SEARCH);
          if (!urls.length) return null;
          return await tryCandidatesConcurrent(fullName, urls, primary.mode, bigBias);
        } catch {
          return null;
        }
      });
      
      // Use Promise.race equivalent that returns first non-null result
      const results = await Promise.all(searchPromises);
      for (const result of results) {
        if (result) {
          picked = result;
          selectedMode = primary.mode;
          break;
        }
      }
    }
  }

  // FALLBACK: Ballotpedia after polling fails
  if (!picked && !expired()) {
    const fallback = buildBallotpediaFallbackQuery(fullName);
    let urls: string[] = [];
    try { urls = await tavilySearch(fallback.queries[0], MAX_RESULTS_PER_SEARCH); } catch {}
    if (urls.length) {
      picked = await tryCandidatesConcurrent(fullName, urls, fallback.mode, bigBias, /*requireBallotpediaHost*/ true);
      if (picked) selectedMode = fallback.mode;
    }
  }

  if (picked) {
    // Prefer approval/disapproval if present; otherwise use votes.
    const hasPoll = (picked.result.approval != null) || (picked.result.disapproval != null);
    const hasVotes = (picked.result.votes != null);

    const saveApproval = hasPoll ? picked.result.approval : null;
    const saveDisapproval = hasPoll ? picked.result.disapproval : null;
    // vote guard already applied in scan; still safe to pass through:
    const saveVotes = (!hasPoll && hasVotes) ? picked.result.votes : null;

    const effectiveMode: "polls" | "votes" = hasPoll ? "polls" : "votes";
    const includeVotes = effectiveMode === "votes";

    const domain = hostOf(picked!.url) || "source";
    const summary = await makePollSummary({
      fullName,
      domain,
      link: picked.url,
      excerpt: picked.excerpt,
      approval: saveApproval,
      disapproval: saveDisapproval,
      votes: includeVotes ? saveVotes : null,
      context_label: picked.result.context_label,
      include_votes: includeVotes,
    });

    return {
      timed_out: false,
      found_any: true,
      poll_link: picked.url,
      approval: saveApproval,
      disapproval: saveDisapproval,
      votes: saveVotes,
      mode: effectiveMode,
      poll_summary: summary,
    };
  }

  // Failure (or timeout) route: No Data
  return {
    timed_out: expired(),
    found_any: false,
    set_nulls_blank: true,
    poll_summary: "No Data",
  };
}

/** ========================== HANDLER ========================== */
Deno.serve(async (req) => {
  const started = Date.now();
  const deadline = started + GLOBAL_TIMEOUT_MS;

  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });
    const pplId = await readId(req);

    // person
    const { data: person, error: pErr } = await supabase
      .from("ppl_index")
      .select("id, name, tier")
      .eq("id", pplId)
      .single();
    if (pErr || !person) return json(404, { error: "ppl_index row not found" });
    const fullName: string = person.name;
    const tier: string = String(person.tier || "").toLowerCase();

    // previous profile row (for wiping)
    const { data: prev, error: prevErr } = await supabase
      .from("ppl_profiles")
      .select("index_id")
      .eq("index_id", pplId)
      .maybeSingle();
    if (prevErr) throw prevErr;

    // ALWAYS wipe first so this run overwrites any old attempt
    if (prev) {
      const { error: wipeErr } = await supabase
        .from("ppl_profiles")
        .update({
          approval: null,
          disapproval: null,
          votes: null,
          poll_summary: null,
          poll_link: null,
        })
        .eq("index_id", pplId);
      if (wipeErr) throw wipeErr;
    }

    const met = await findMetricsForPerson(pplId, fullName, tier, prev, deadline);

    // Build patch per outcome
    let patch: Record<string, any> | null = null;

    if (met.found_any) {
      const includeVotes = (met as any).mode === "votes";
      patch = {
        poll_link: met.poll_link || null,
        approval: met.approval,
        disapproval: met.disapproval,
        votes: includeVotes ? met.votes : null,
        poll_summary: met.poll_summary || "",
        updated_at: nowIso(),
      };
    } else {
      // Failure/timeout: write "No Data" and leave numbers blank
      patch = {
        poll_link: null,
        approval: null,
        disapproval: null,
        votes: null,
        poll_summary: (met as any).poll_summary || "No Data",
        updated_at: nowIso(),
      };
    }

    // Persist (atomic upsert on index_id)
    const upsertRow = { index_id: pplId, ...patch };
    const { error: upsertErr } = await supabase
      .from("ppl_profiles")
      .upsert(upsertRow, {
        onConflict: "index_id",
        ignoreDuplicates: false,
        defaultToNull: false,
      });
    if (upsertErr) throw upsertErr;

    return json(200, {
      id: pplId,
      name: fullName,
      tier,
      notes: `Metrics v2.9: CONCURRENT URL probing (batches of ${CONCURRENCY}); strict digit-only extraction + numeric parser; guard tiny vote counts (<1000); summary only describes saved numbers (no missing-data notes); centrality reads up to 110k; base-tier starts with Ballotpedia; per-search up to 3 links in parallel; failure-> "No Data"; wipe-first overwrite; global timeout=${GLOBAL_TIMEOUT_MS}ms.`,
      outcome: met,
    });

  } catch (e: any) {
    console.error(e);
    return json(500, { error: String(e?.message || e || "unknown error") });
  }
});
