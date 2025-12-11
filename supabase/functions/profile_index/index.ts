/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!; // for legislation only
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";

const PART_LEN = 110_000; // split stored pages into ~110k-char parts

/** Generous timeouts (ms) */
const WIKI_TIMEOUT_MS = Number(Deno.env.get("WIKI_TIMEOUT_MS") ?? 15000);

/** ========================== CONCURRENCY ========================== */
const CONCURRENCY_DEFAULT = Number(Deno.env.get("CONCURRENCY_DEFAULT") ?? 15);
const CONCURRENCY_MAX = Number(Deno.env.get("CONCURRENCY_MAX") ?? 15);
const CONCURRENCY_MIN = 1;

function clampInt(n: number, lo: number, hi: number) {
  n = Math.floor(Number.isFinite(n) ? n : lo);
  return Math.max(lo, Math.min(hi, n));
}

/** Read concurrency from header/query/env (priority: header > query > env) */
function resolveConcurrency(req: Request): number {
  try {
    const hdr = req.headers.get("x-concurrency");
    if (hdr) return clampInt(Number(hdr), CONCURRENCY_MIN, CONCURRENCY_MAX);
  } catch {}
  try {
    const url = new URL(req.url);
    const qp = url.searchParams.get("concurrency");
    if (qp) return clampInt(Number(qp), CONCURRENCY_MIN, CONCURRENCY_MAX);
  } catch {}
  return clampInt(CONCURRENCY_DEFAULT, CONCURRENCY_MIN, CONCURRENCY_MAX);
}

/** Tiny p-limit style limiter */
function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= max) return;
    const fn = queue.shift();
    if (fn) fn();
  };
  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        task().then(
          (v) => { active--; resolve(v); next(); },
          (e) => { active--; reject(e); next(); }
        );
      };
      if (active < max) run(); else queue.push(run);
    });
  };
}

/** Run tasks with concurrency and keep input order for results */
async function mapLimit<T, R>(items: T[], max: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const limit = createLimiter(max);
  const out: R[] = new Array(items.length);
  await Promise.all(items.map((item, i) =>
    limit(async () => { out[i] = await fn(item, i); })
  ));
  return out;
}

/** First success helper with concurrency; resolves with first fulfilled result */
async function firstSuccessful<T>(tasks: Array<() => Promise<T>>, max: number): Promise<T> {
  const limit = createLimiter(max);
  let settled = false;
  return new Promise<T>((resolve, reject) => {
    let pending = tasks.length;
    if (!pending) return reject(new Error("No tasks"));
    const onFulfill = (v: T) => {
      if (!settled) { settled = true; resolve(v); }
    };
    const onReject = () => {
      pending--;
      if (!settled && pending === 0) reject(new Error("All candidates failed"));
    };
    for (const t of tasks) {
      limit(() => t().then(onFulfill, onReject));
    }
  });
}

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
/** Mistral API key (needed for extraction) */
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;

/** Call Mistral and return JSON */
async function mistralJSON(system: string, user: string, max_tokens = 600) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      temperature: 0.0,
      response_format: { type: "json_object" },
      max_tokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  if (!r.ok) throw new Error(`Mistral error ${r.status}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round2 = (x: number) => Number(x.toFixed(2));
const now = new Date();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url: string, timeout = WIKI_TIMEOUT_MS) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return r.json();
}
async function fetchTEXT(url: string, timeout = WIKI_TIMEOUT_MS) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return r.text();
}

/** Escape keywords before turning them into RegExp */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A tiny retry: if a Wikipedia step flakes (timeout/429/random), retry once with jitter. */
async function withTinyRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (_e) {
    await sleep(300 + Math.floor(Math.random() * 300));
    return await fn();
  }
}

/** ========================== STORAGE HELPERS ========================== */
async function putParts(basePath: string, content: string, conc = 4): Promise<string[]> {
  const parts: string[] = [];
  for (let i = 0; i < content.length; i += PART_LEN) parts.push(content.slice(i, i + PART_LEN));

  if (parts.length === 1) {
    const path = `${basePath}.txt`;
    const { error } = await supabase.storage
      .from(WEB_BUCKET)
      .upload(path, new Blob([parts[0]], { type: "text/plain; charset=utf-8" }), {
        upsert: true,
        contentType: "text/plain; charset=utf-8",
      });
    if (error) throw error;
    return [path];
  }

  const paths = parts.map((_, idx) => `${basePath}.${idx + 1}.txt`);
  await mapLimit(parts, conc, async (part, idx) => {
    const { error } = await supabase.storage
      .from(WEB_BUCKET)
      .upload(paths[idx], new Blob([part], { type: "text/plain; charset=utf-8" }), {
        upsert: true,
        contentType: "text/plain; charset=utf-8",
      });
    if (error) throw error;
  });
  return paths;
}

async function listStoredWikiPaths(id: number): Promise<string[]> {
  const prefix = `ppl/${id}`;
  const { data, error } = await supabase.storage
    .from(WEB_BUCKET)
    .list(prefix, { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (error || !data) return [];
  const names = data
    .filter((f) => f.name.startsWith("profile.wikipedia") && f.name.endsWith(".txt"))
    .map((f) => `${prefix}/${f.name}`);
  names.sort((a, b) => {
    const am = a.match(/profile\.wikipedia\.(\d+)\.txt$/);
    const bm = b.match(/profile\.wikipedia\.(\d+)\.txt$/);
    const ai = am?.[1] ? Number(am[1]) : 1;
    const bi = bm?.[1] ? Number(bm[1]) : 1;
    return ai - bi;
  });
  return names;
}

async function downloadAll(paths: string[], conc = 4): Promise<string> {
  if (!paths.length) return "";
  const texts = await mapLimit(paths, conc, async (p) => {
    const { data } = await supabase.storage.from(WEB_BUCKET).download(p);
    return data ? await data.text() : "";
  });
  return texts.join(""); // preserves original order
}

/** ========================== ROLE HINTS (from sub_name) ========================== */
type RoleKey =
  | "president"
  | "vice_president"
  | "senator"
  | "representative"
  | "governor"
  | "mayor"
  | "cabinet"
  | "candidate"
  | "unknown";

function roleFromSubName(sub_name?: string | null): RoleKey {
  if (!sub_name) return "unknown";
  const t = sub_name.toLowerCase();
  if (/\bvice\s*president\b/.test(t)) return "vice_president";
  if (/\bpresident\b/.test(t)) return "president";
  if (/\bsenator\b/.test(t)) return "senator";
  if (/\brepresentative\b|\bcongress(wo)?man\b|\bmember of the u\.?s\.? house\b/.test(t)) return "representative";
  if (/\bgovernor\b/.test(t)) return "governor";
  if (/\bmayor\b/.test(t)) return "mayor";
  if (/\bsecretary of\b|\bcabinet\b/.test(t)) return "cabinet";
  if (/\bcandidate\b|\brunning for\b|\bexploratory committee\b/.test(t)) return "candidate";
  return "unknown";
}

function roleHint(sub_name?: string | null) {
  const r = roleFromSubName(sub_name);
  switch (r) {
    case "president":
      return "president";
    case "vice_president":
      return "vice president";
    case "senator":
      return "senator";
    case "representative":
      return "representative";
    case "governor":
      return "governor";
    case "mayor":
      return "mayor";
    case "cabinet":
      return "cabinet";
    case "candidate":
      return "candidate";
    case "unknown":
    default:
      return "politician";
  }
}

/** ========================== WIKIPEDIA (exact title → one search fallback) ========================== */
function nameToKey(name: string) {
  return name.trim().replace(/\s+/g, "_");
}

async function fetchWikiPlainByTitle(title: string) {
  // Try REST plain first
  try {
    return await withTinyRetry(() =>
      fetchTEXT(`https://en.wikipedia.org/api/rest_v1/page/plain/${encodeURIComponent(title)}`)
    );
  } catch (_) {
    // Fallback: Action API extract
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      explaintext: "1",
      redirects: "1",
      titles: title,
      format: "json",
      formatversion: "2",
    });
    const j: any = await withTinyRetry(() => fetchJSON(`https://en.wikipedia.org/w/api.php?${params.toString()}`));
    const page = j?.query?.pages?.[0];
    const extract = page?.extract;
    if (typeof extract === "string" && extract.trim()) return extract;
    throw new Error("empty extract");
  }
}

/** The minimal resolver:
 *  1) Exact key summary (reject disambiguation) → plain
 *  2) One search pass (REST v1) with role hint → first non-disambig summary → plain (parallel candidates)
 */
async function fetchWikipediaText(name: string, sub_name?: string | null, conc = 3): Promise<{ text: string; url: string }> {
  // 0) Exact title try
  const key = nameToKey(name);
  try {
    const sum: any = await withTinyRetry(() =>
      fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`)
    );
    if (sum?.type !== "disambiguation") {
      const txt = await fetchWikiPlainByTitle(sum?.title || name);
      if (txt && txt.length > 200) {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(sum?.title || name)}`;
        return { text: txt, url };
      }
    }
  } catch {
    /* go to search */
  }

  // 1) One REST search pass with role hint and simple fallbacks
  const hint = roleHint(sub_name);
  const queries = [`${name} ${hint}`, `${name} politician`, name];
  for (const q of queries) {
    try {
      const rest: any = await withTinyRetry(() =>
        fetchJSON(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=3`)
      );
      const pages = rest?.pages || [];
      if (pages.length) {
        const tasks = pages.slice(0, 4).map((p: any) => {
          const candKey = p?.key || p?.title;
          return async () => {
            if (!candKey) throw new Error("no key");
            const sum: any = await withTinyRetry(() =>
              fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candKey)}`)
            );
            if (sum?.type === "disambiguation") throw new Error("disambig");
            const title = sum?.title || p?.title;
            const txt = await fetchWikiPlainByTitle(title);
            if (!txt || txt.length < 200) throw new Error("short");
            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
            return { text: txt, url };
          };
        });
        try {
          const best = await firstSuccessful(tasks, conc);
          return best;
        } catch {
          /* fall through to next query */
        }
      }
    } catch {
      /* next query */
    }
  }

  throw new Error(`Wikipedia not found for "${name}"`);
}

/** Find a fallback URL for a person when Wikipedia lookup fails */
async function findFallbackPersonUrl(name: string, conc = 3): Promise<string | null> {
  const queries = [
    `${name} official site`,
    `${name} biography`,
    `${name} site:.gov`,
    `${name} site:.edu`,
    `${name} site:.org`,
    `${name} site:.us`,
  ];
  const judge = (u: string) => {
    try {
      const host = new URL(u).host.toLowerCase();
      if (/wikipedia\.org|wikidata\.org|wikimedia\.org/.test(host)) return false;
      return /\.(gov|edu|org|us)$/.test(host) || /official|office|senate|house|governor|mayor/.test(host);
    } catch { return false; }
  };
  const tasks: Array<() => Promise<string>> = [];
  for (const q of queries) {
    tasks.push(async () => {
      const results = await tavilySearch(q);
      const pick = (results || []).find((u) => judge(u));
      if (!pick) throw new Error("no pick");
      return pick;
    });
  }
  try {
    return await firstSuccessful(tasks, conc);
  } catch {
    return null;
  }
}

/** ========================== TEXT PARSERS (Wikipedia only) ========================== */
function normalizeWS(s: string) {
  return s.replace(/\r/g, "");
}

function detectOfficeType(
  text: string
): "president" | "vice_president" | "senator" | "representative" | "governor" | "mayor" | "cabinet" | "candidate" | null {
  const t = text.toLowerCase();
  if (/\bpresident of the united states\b/.test(t)) return "president";
  if (/\bvice president of the united states\b/.test(t)) return "vice_president";
  if (/\b(united states senator|u\.s\. senator|us senator)\b/.test(t)) return "senator";
  if (/\b(united states representative|u\.s\. representative|us representative|member of the u\.s\. house)\b/.test(t))
    return "representative";
  if (/\bgovernor of [a-z ]+/.test(t)) return "governor";
  if (/\bmayor of [a-z ]+/.test(t)) return "mayor";
  if (/\bunited states secretary of\b/.test(t) || /\bthe cabinet\b/.test(t)) return "cabinet";
  if (/\bcandidate\b/.test(t) && /\b(election|presidential|senate|governor)\b/.test(t)) return "candidate";
  return null;
}

function mapGovLevel(office: string | null): "federal" | "state" | "city" | null {
  if (!office) return null;
  if (office === "president" || office === "vice_president" || office === "cabinet") return "federal";
  if (office === "governor" || office === "senator") return "state";
  if (office === "candidate" || office === "representative" || office === "mayor") return "city"; // per your mapping
  return null;
}

function detectPartyType(text: string): "R" | "D" | "I" | "other" | null {
  const t = text.toLowerCase();
  if (/\b(republican party|republican)\b/.test(t)) return "R";
  if (/\b(democratic party|democrat)\b/.test(t)) return "D";
  if (/\b(independent)\b/.test(t)) return "I";
  return "other";
}

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, "-");
}

/** State codes (for writing, not for search) */
const STATE_CODES: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

function findStateCode(text: string, office: string | null): string | null {
  if (!office) return null;
  if (!(office === "representative" || office === "senator" || office === "governor" || office === "mayor")) return null;
  for (const [state, code] of Object.entries(STATE_CODES)) {
    const pat = new RegExp(`\\b(from|of) ${escapeRegExp(state)}\\b`, "i");
    if (pat.test(text)) return code;
  }
  for (const [state, code] of Object.entries(STATE_CODES)) {
    const pat = new RegExp(`\\b${escapeRegExp(state)}\\b`, "i");
    if (pat.test(text)) return code;
  }
  return null;
}

function isIncumbent(text: string): boolean {
  const t = text.toLowerCase();
  if (/\bincumbent\b/.test(t)) return true;
  if (/\bpresent\)/.test(t) || /\b–\s*present/.test(t)) return true;
  if (/\bhas served since\s+\d{4}\b/.test(t)) return true;
  return false;
}

function parseYearsInCurrentRole(text: string): number | null {
  const assumed = /assumed office\b[^0-9]{0,40}([A-Z][a-z]+ \d{1,2}, \d{4}|\d{4})/i.exec(text);
  if (assumed?.[1]) {
    const d = new Date(assumed[1]);
    if (!isNaN(+d)) return Math.max(0, (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
    const y = parseInt(assumed[1].slice(-4), 10);
    if (y) return Math.max(0, now.getFullYear() - y);
  }
  const since = /has served since\s+(\d{4})/i.exec(text);
  if (since?.[1]) {
    const y = parseInt(since[1], 10);
    return Math.max(0, now.getFullYear() - y);
  }
  return null;
}
/** ========================== PERSON EXTRACT (lead slice + Mistral) ========================== */

/** Build a high-signal slice: lead + any “office lines” */
function sliceForPersonExtraction(full: string): string {
  const lead = full.slice(0, 6000);
  const lines = full.split(/\r?\n/);
  const hits: string[] = [];
  const rx = /(Assumed office|Member of the|United States (Senator|Representative)|Governor of|Mayor of|U\.S\. (Senator|Representative))/i;
  for (const ln of lines) {
    if (rx.test(ln)) hits.push(ln.trim());
    if (hits.length >= 50) break;
  }
  const tail = hits.join("\n");
  return (lead + "\n" + tail).slice(0, 9000);
}

type PersonExtract = {
  office_type: "president"|"vice_president"|"senator"|"representative"|"governor"|"mayor"|"cabinet"|"candidate"|null;
  party_type: "R"|"D"|"I"|"other"|null;
  state_name: string|null;
  state_code: string|null;
  incumbent: boolean|null;
  evidence: { office?: string; party?: string; state?: string };
};

async function mistralExtractPerson(name: string, slice: string, role_hint: string): Promise<PersonExtract> {
  const sys = `You are a strict information extractor. Return ONLY JSON. 
- Use ONLY facts present in the provided text. 
- If a value is not explicitly stated for THIS person, return null.
- Return short "evidence" snippets copied verbatim from the slice.`;

  const usr = `
PERSON: ${name}
ROLE_HINT: ${role_hint}

TEXT (lead + office lines):
"""${slice}"""

Return JSON with these keys:

{
  "office_type": "president"|"vice_president"|"senator"|"representative"|"governor"|"mayor"|"cabinet"|"candidate"|null,
  "party_type": "R"|"D"|"I"|"other"|null,
  "state_name": "<full U.S. state name or 'District of Columbia' or null>",
  "state_code": "<two-letter code or null>",
  "incumbent": true|false|null,
  "evidence": {
    "office": "<short phrase from the slice>",
    "party": "<short phrase from the slice>",
    "state": "<short phrase from the slice>"
  }
}

Rules:
- "office_type": infer only for THIS person (not other people mentioned). Prefer phrases like "United States Representative", "Member of the U.S. House", "United States Senator", "Governor of <State>", "Mayor of <City>".
- If the slice contains "at-large congressional district" or "district <number>" for THIS person, that means "representative".
- "party_type": map Democratic/Democrat -> "D", Republican -> "R", Independent -> "I", else "other".
- "state_*": only set if the state clearly refers to THIS person's jurisdiction (e.g., "from Wyoming", "of Florida"). If unsure, return null.
- "incumbent": true if they currently hold the office (e.g., "incumbent", "– present", "has served since <year>"); false if clearly former; null if unclear.`;

  const j = await mistralJSON(sys, usr, 700);
  return {
    office_type: j?.office_type ?? null,
    party_type: j?.party_type ?? null,
    state_name: j?.state_name ?? null,
    state_code: j?.state_code ?? null,
    incumbent: (typeof j?.incumbent === "boolean") ? j.incumbent : null,
    evidence: (j?.evidence && typeof j.evidence === "object") ? j.evidence : {}
  };
}

/** Proximity-based state detector: require state near an office cue (same line) */
function findStateCodeNearOffice(text: string, office: string | null): string | null {
  if (!office) return null;
  const lines = text.split(/\r?\n/);
  const officeRx =
    office === "senator" ? /(United States Senator|U\.S\. Senator|Senator from)/i :
    office === "representative" ? /(United States Representative|U\.S\. Representative|Member of the U\.S\. House)/i :
    office === "governor" ? /(Governor of)/i :
    office === "mayor" ? /(Mayor of)/i : null;
  if (!officeRx) return null;

  for (const ln of lines) {
    if (!officeRx.test(ln)) continue;
    for (const [state, code] of Object.entries(STATE_CODES)) {
      const srx = new RegExp(`\\b(${escapeRegExp(state)}|${code})\\b`, "i");
      if (srx.test(ln)) return code;
    }
  }
  return null;
}

/** Fuse Mistral + deterministic rules into final person fields */
async function extractPersonFields(
  name: string,
  fullText: string,
  sub_name?: string | null
): Promise<{ office_type: PersonExtract["office_type"]; party_type: PersonExtract["party_type"]; state_code: string|null; incumbent: boolean; confidence: number; source: "mistral"|"deterministic"; }> {
  const slice = sliceForPersonExtraction(fullText);
  const hint = roleHint(sub_name);

  // Mistral pass with evidence
  let mx: PersonExtract | null = null;
  try { mx = await mistralExtractPerson(name, slice, hint); } catch { mx = null; }

  // Deterministic fallbacks on SLICE (not whole page)
  const detOffice = detectOfficeType(slice);
  const detParty = detectPartyType(slice);
  const detStateNear = findStateCodeNearOffice(slice, detOffice);
  const inc = isIncumbent(slice);

  // Override: if slice contains House cues, prefer representative
  const houseCues = /(at-large congressional district|Member of the (U\.S\. )?House|United States Representative|Congress(woman|man))/i.test(slice);
  const officeAfterOverride =
    (mx?.office_type ?? detOffice) === "senator" && houseCues ? "representative" :
    (mx?.office_type ?? detOffice);

  // Choose state code (Mistral > proximity > global weak scan)
  const fromMxCode =
    (mx?.state_code && /^[A-Z]{2}$/.test(mx.state_code)) ? mx.state_code :
    (mx?.state_name && STATE_CODES[mx.state_name] ? STATE_CODES[mx.state_name] : null);

  let state_code = fromMxCode ?? detStateNear ?? findStateCode(slice, officeAfterOverride);

  // Confidence heuristic
  let confidence = 0;
  if (mx) {
    if (mx.evidence?.office && officeAfterOverride) confidence += 0.5;
    if ((mx.evidence?.state && state_code) || (fromMxCode && state_code === fromMxCode)) confidence += 0.3;
    if (mx.evidence?.party && (mx.party_type || detParty)) confidence += 0.2;
  } else {
    if (officeAfterOverride) confidence += 0.4;
    if (state_code) confidence += 0.3;
    if (detParty) confidence += 0.2;
  }
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    office_type: officeAfterOverride ?? null,
    party_type: (mx?.party_type ?? detParty ?? null),
    state_code: state_code ?? null,
    incumbent: (mx?.incumbent ?? inc ?? false),
    confidence,
    source: mx ? "mistral" : "deterministic",
  };
}

/** ========================== LIMIT SCORE / TIER ========================== */
type Pillars = { P1: number; P2: number; P3: number; P4: number; P5: number; P6: number };

function computePillarsWikiOnly(text: string, office: ReturnType<typeof detectOfficeType>): Pillars {
  const T = normalizeWS(text);

  // P1 Structural power
  const base: Record<string, number> = {
    president: 0.95,
    vice_president: 0.85,
    senator: 0.6,
    governor: 0.5,
    representative: 0.35,
    mayor: 0.2,
    cabinet: 0.3,
    candidate: 0.18,
  };
  let P1 = base[office ?? "candidate"] ?? 0.18;
  const boosts: [RegExp, number][] = [
    /\bSpeaker of the House\b/i,
    0.2,
    /\b(Majority|Minority)\s+Leader\b/i,
    0.12,
    /\bWhip\b/i,
    0.08,
    /\b(Committee|Subcommittee)\s+(Chair|Chairman|Chairwoman)\b/i,
    0.08,
    /\bRanking Member\b/i,
    0.05,
    /\b(Conference|Caucus)\s+(Chair|Co[- ]Chair)\b/i,
    0.04,
  ];
  let add = 0;
  for (let i = 0; i < boosts.length; i += 2) {
    const rx = boosts[i] as unknown as RegExp;
    const val = boosts[i + 1] as unknown as number;
    if (rx.test(T)) add += val;
  }
  P1 = clamp01(P1 + Math.min(add, 0.2));

  // P2 Tenure & incumbency (fast saturation)
  const yrs = parseYearsInCurrentRole(T);
  const P2 = clamp01(yrs ? Math.min(yrs, 12) / 12 : 0);

  // P3 Documentation depth (length, sections, citations)
  const totalChars = T.length;
  const lenNorm = Math.pow(clamp01(totalChars / 110_000), 0.5);
  const sectionHits =
    (T.match(/(^|\n)={2,4}\s*[^=\n]+?\s*={2,4}\s*$/gm) || []).length +
    (T.match(/(^|\n)#+\s+[^\n]+/g) || []).length +
    (T.match(/\n[A-Z][A-Za-z ]{3,}\n[-–]{3,}\n/g) || []).length;
  const secNorm = clamp01(sectionHits / 25);
  const citationHits = (T.match(/\[[0-9]{1,4}\]/g) || []).length + (T.match(/\bcitation needed\b/gi) || []).length;
  const refNorm = clamp01(citationHits / 150);
  const P3 = clamp01(0.5 * lenNorm + 0.3 * secNorm + 0.2 * refNorm);

  // P4 Public prominence — FIX: escape keywords when building regex
  const yearCount = (T.match(/\b(19|20)\d{2}\b/g) || []).length;
  const mediaWords = [
    "Twitter",
    "X (formerly",
    "Instagram",
    "TikTok",
    "YouTube",
    "television",
    "TV",
    "media",
    "press",
    "headline",
    "viral",
    "controversy",
    "controversies",
    "public image",
    "impeachment",
    "indictment",
    "The Apprentice",
    "campaign",
  ];
  let mediaHits = 0;
  for (const w of mediaWords) {
    mediaHits += (T.match(new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi")) || []).length;
  }
  const yearNorm = clamp01(yearCount / 1500);
  const mediaNorm = clamp01(mediaHits / 250);
  const P4 = clamp01(0.5 * yearNorm + 0.5 * mediaNorm);

  // P5 Networks & committees (legislators only)
  let P5 = 0;
  if (office === "representative" || office === "senator") {
    const tierA = [
      "Appropriations",
      "Ways and Means",
      "Energy and Commerce",
      "Rules",
      "Judiciary",
      "Intelligence",
      "Armed Services",
      "Foreign Relations",
      "Finance",
      "HELP",
      "Financial Services",
    ];
    let pts = 0;
    for (const c of tierA) {
      const rx = new RegExp(`Committee[^\\n]{0,80}${escapeRegExp(c)}|${escapeRegExp(c)}[^\\n]{0,80}Committee`, "i");
      if (rx.test(T)) pts += 0.02;
    }
    P5 = clamp01(Math.min(pts, 0.1));
  }

  // P6 Ideology/movement salience
  const P6 = /\bDemocratic Socialists of America\b/i.test(T) ? 1 : 0;

  return { P1, P2, P3, P4, P5, P6 };
}

function tierFromRoundedScore(score2d: number): "base" | "soft" | "hard" {
  if (score2d >= 0.7) return "hard";
  if (score2d >= 0.45) return "soft";
  return "base";
}
function demoteTierOnce(t: "base" | "soft" | "hard"): "base" | "soft" | "hard" {
  return t === "hard" ? "soft" : t === "soft" ? "base" : "base";
}

function computeLimitScore(text: string, office: ReturnType<typeof detectOfficeType>, incumbent: boolean) {
  const { P1, P2, P3, P4, P5, P6 } = computePillarsWikiOnly(text, office);

  // weights
  let raw = 0.35 * P1 + 0.05 * P2 + 0.2 * P3 + 0.3 * P4 + 0.1 * P5 + 0.05 * P6;

  // caps/floors
  const floors: Record<string, number> = { president: 0.9, vice_president: 0.85, senator: 0.5, governor: 0.4 };
  const defaultCaps: Record<string, number> = { representative: 0.6, mayor: 0.4, cabinet: 0.4, candidate: 0.4 };
  let cap = defaultCaps[office ?? ""] ?? 1.0;

  // Representative notability override
  if (office === "representative") {
    if (P3 >= 0.9 && P4 >= 0.85 && (P5 >= 0.04 || P6 === 1)) cap = 0.8;
  }
  // Superstar override for Pres/VP
  if ((office === "president" || office === "vice_president") && P3 >= 0.95 && P4 >= 0.95) {
    raw = Math.max(raw, 1.0);
  }

  let scored = Math.min(raw, cap);
  if (office && floors[office] != null) scored = Math.max(scored, floors[office]);

  // Round THEN map tier, then demote if not incumbent
  const scoreRounded = round2(scored);
  let tier: "base" | "soft" | "hard" = tierFromRoundedScore(scoreRounded);
  if (!incumbent) tier = demoteTierOnce(tier);

  return { score: scoreRounded, tier, pillars: { P1, P2, P3, P4, P5, P6 } };
}

/** ========================== INDEXED STATUS MANAGEMENT ========================== */

/**
 * Check if a politician profile is properly indexed and update the indexed column
 * A profile is considered indexed when:
 * - It has a row in ppl_profiles
 * - It has a value in ppl_profiles.synopsis
 * - It has a value for "updated_at" in ppl_profiles
 */
async function updatePoliticianIndexedStatus(id: number): Promise<void> {
  try {
    const { data: profileData, error } = await supabase
      .from("ppl_profiles")
      .select("synopsis, updated_at")
      .eq("index_id", id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn(`Error checking ppl_profiles for id ${id}:`, error);
      return;
    }

    const isIndexed = !!(
      profileData && 
      profileData.synopsis && 
      profileData.updated_at
    );

    const { error: updateError } = await supabase
      .from("ppl_index")
      .update({ indexed: isIndexed })
      .eq("id", id);

    if (updateError) {
      console.warn(`Failed to update indexed status for ppl_index id ${id}:`, updateError);
    } else {
      console.log(`Updated indexed status for ppl_index id ${id}: ${isIndexed}`);
    }
  } catch (error) {
    console.error(`Error in updatePoliticianIndexedStatus for id ${id}:`, error);
  }
}

/**
 * Check if a legislation profile is properly indexed and update the indexed column
 * A profile is considered indexed when:
 * - It has a row in legi_profiles
 * - It has a value in legi_profiles.overview
 * - It has a value for "updated_at" in legi_profiles
 */
async function updateLegislationIndexedStatus(id: number): Promise<void> {
  try {
    const { data: profileData, error } = await supabase
      .from("legi_profiles")
      .select("overview, updated_at")
      .eq("owner_id", id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn(`Error checking legi_profiles for id ${id}:`, error);
      return;
    }

    const isIndexed = !!(
      profileData && 
      profileData.overview && 
      profileData.updated_at
    );

    const { error: updateError } = await supabase
      .from("legi_index")
      .update({ indexed: isIndexed })
      .eq("id", id);

    if (updateError) {
      console.warn(`Failed to update indexed status for legi_index id ${id}:`, updateError);
    } else {
      console.log(`Updated indexed status for legi_index id ${id}: ${isIndexed}`);
    }
  } catch (error) {
    console.error(`Error in updateLegislationIndexedStatus for id ${id}:`, error);
  }
}

/** ========================== WEEKLY VISITS TRACKING ========================== */
/** 
 * Update weekly visits count for a profile (politician or legislation)
 * 
 * This function tracks how many times a profile has been visited in the current week.
 * Every time a user enters a profile, it increments the weekly_visits counter by 1.
 * If weekly_visits is NULL or if a week or more has passed since the last visit,
 * it resets the counter to 1 and updates the week timestamp.
 * 
 * The function gracefully handles cases where the weekly_visits and week columns
 * don't exist yet in the database tables.
 */
async function updateWeeklyVisits(tableName: "ppl_index" | "legi_index", id: number): Promise<void> {
  try {
    // Get current timestamp for this week
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0);
    
    // Check if columns exist by trying to select them
    const { data: currentData, error: selectError } = await supabase
      .from(tableName)
      .select("weekly_visits, week")
      .eq("id", id)
      .single();
    
    if (selectError) {
      // Columns don't exist yet, skip tracking
      console.log(`Weekly visits columns not found in ${tableName}, skipping tracking`);
      return;
    }
    
    const currentWeekTimestamp = currentWeekStart.toISOString();
    const currentWeekVisits = currentData?.weekly_visits || 0;
    const storedWeek = currentData?.week;
    
    // Check if we need to reset (new week or week column is null)
    const shouldReset = !storedWeek || new Date(storedWeek).getTime() < currentWeekStart.getTime();
    
    // Update with new visit count
    const newVisitCount = shouldReset ? 1 : (currentWeekVisits + 1);
    
    const updateData = {
      weekly_visits: newVisitCount,
      week: currentWeekTimestamp
    };
    
    const { error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq("id", id);
    
    if (updateError) {
      console.error(`Error updating weekly visits for ${tableName} id ${id}:`, updateError);
    } else {
      console.log(`Updated weekly visits for ${tableName} id ${id}: ${newVisitCount} (reset: ${shouldReset})`);
    }
  } catch (error) {
    console.error(`Error in updateWeeklyVisits for ${tableName} id ${id}:`, error);
    // Don't throw - this is non-critical tracking
  }
}

/** ========================== ppl (Wikipedia) ========================== */
async function handlePersonById(id: number, conc: number) {
  console.log(`[PROFILE_INDEX] ===== START: Processing politician ID ${id} =====`);
  
  // 0) Update weekly visits tracking
  console.log(`[PROFILE_INDEX] Step 0: Updating weekly visits for ID ${id}`);
  await updateWeeklyVisits("ppl_index", id);
  
  // 1) fetch row
  console.log(`[PROFILE_INDEX] Step 1: Fetching ppl_index row for ID ${id}`);
  const { data: row, error } = await supabase.from("ppl_index").select("*").eq("id", id).single();
  if (error || !row) {
    console.error(`[PROFILE_INDEX] FAIL: ppl_index row not found for ID ${id}:`, error);
    throw new Error(`ppl_index id ${id} not found`);
  }
  const name: string = row.name || row.full_name || row.display_name;
  if (!name) {
    console.error(`[PROFILE_INDEX] FAIL: No name found for ID ${id}`);
    throw new Error(`ppl_index id ${id} has no name`);
  }
  console.log(`[PROFILE_INDEX] Found politician: ${name}`);

  // 2) STORAGE-FIRST: if a page is already stored, parse it and skip network
  console.log(`[PROFILE_INDEX] Step 2: Checking for existing stored Wikipedia content for ID ${id}`);
  let wikiText = "";
  let wikiUrl = ""; // Track the Wikipedia URL used
  const existing = await listStoredWikiPaths(id);
  if (existing.length) {
    console.log(`[PROFILE_INDEX] Found ${existing.length} existing storage files, downloading...`);
    wikiText = await downloadAll(existing, conc);
    console.log(`[PROFILE_INDEX] Downloaded ${wikiText.length} characters from storage`);
    // Try to get the Wikipedia URL from stored content or construct a fallback
    wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`;
  } else {
    console.log(`[PROFILE_INDEX] No existing storage found, will fetch from Wikipedia`);
  }

  // 3) Fetch from Wikipedia if nothing usable in storage
  console.log(`[PROFILE_INDEX] Step 3: Fetching Wikipedia content (current length: ${wikiText.length})`);
  let storedNewPage = false; // NEW: track if we stored new content
  if (!wikiText || wikiText.length < 200) {
    const sub_name: string | null | undefined = row.sub_name ?? row.office_type ?? null;
    console.log(`[PROFILE_INDEX] Searching Wikipedia for "${name}" (sub_name: ${sub_name || 'none'})`);
    try {
      const wikiResult = await fetchWikipediaText(name, sub_name, conc);
      wikiText = wikiResult.text;
      wikiUrl = wikiResult.url;
      console.log(`[PROFILE_INDEX] SUCCESS: Fetched ${wikiText.length} characters from ${wikiUrl}`);
    } catch (e) {
      // ---- NEW: Wikipedia not found → fallback ----
      console.warn(`[PROFILE_INDEX] Wikipedia not found for "${name}" (id=${id}), error:`, e);
      console.log(`[PROFILE_INDEX] Attempting fallback search for "${name}"`);
      const fallbackUrl = await findFallbackPersonUrl(name, conc);
      if (fallbackUrl) {
        console.log(`[PROFILE_INDEX] SUCCESS: Found fallback url=${fallbackUrl}`);
        const ext = await webExtractOneWithRetry(fallbackUrl);
        wikiText = ext.parseText;          // use text for downstream extract
        wikiUrl  = fallbackUrl;            // keep the url for response/debug
        console.log(`[PROFILE_INDEX] Extracted ${wikiText.length} characters from fallback`);
        // Mark weak = TRUE (sticky) since no Wikipedia page
        console.log(`[PROFILE_INDEX] Marking politician ID ${id} as weak (no Wikipedia)`);
        await supabase.from("ppl_index").update({ weak: true }).eq("id", id);
      } else {
        // No fallback either → mark weak and use minimal stub to store
        console.warn(`[PROFILE_INDEX] FAIL: No fallback found for "${name}" (id=${id}); using stub + weak=true`);
        await supabase.from("ppl_index").update({ weak: true }).eq("id", id);
        wikiText = `No Wikipedia page found for ${name}. No suitable fallback page discovered.`;
        wikiUrl = "";
      }
    }

    // Store whatever we got (Wikipedia text OR fallback text OR stub)
    console.log(`[PROFILE_INDEX] Step 3b: Storing content to storage (${wikiText.length} chars)`);
    await putParts(`ppl/${id}/profile.wikipedia`, wikiText, conc);
    storedNewPage = true; // NEW
    console.log(`[PROFILE_INDEX] Content stored successfully`);
    // Note: indexed status will be updated when ppl_profiles is completed
  } else {
    console.log(`[PROFILE_INDEX] Skipping Wikipedia fetch - using existing content (${wikiText.length} chars)`);
  }

  // 4) parse fields (Mistral + deterministic on lead slice)
  console.log(`[PROFILE_INDEX] Step 4: Extracting person fields using Mistral`);
  const text = wikiText;
  const ext = await extractPersonFields(name, text, row.sub_name);
  console.log(`[PROFILE_INDEX] Extraction complete - confidence: ${ext.confidence}, office_type: ${ext.office_type}, party: ${ext.party_type}`);

  const slug = row.slug || (row.name ? toSlug(row.name) : null);

  // prefer existing values unless missing OR new extraction is high-confidence and coherent
  function prefer<T>(existing: T | null | undefined, fresh: T | null | undefined, minConf = 0.8): T | null | undefined {
    if (existing == null) return fresh ?? null;
    if (fresh == null) return existing;
    return (ext.confidence >= minConf) ? fresh : existing;
  }

  const office_type_extracted = prefer(row.office_type, ext.office_type);
  const gov_level  = prefer(row.gov_level, mapGovLevel(ext.office_type));
  const party_type = prefer(row.party_type, ext.party_type);
  const state_code = prefer(row.state_code, ext.state_code);

  // ================== SMALL ADDITIONS (politician rules) ==================
  const subNameStr = (row.sub_name ?? "").toString();
  const hasSecretary = /\bsecretary\b/i.test(subNameStr);
  const isFormer = /\bformer\b/i.test(subNameStr);
  const knownRoleRx = /\b(president|vice\s*president|senator|representative|governor|mayor|cabinet|candidate)\b/i;
  const subNameIsUnknownRole = subNameStr.length > 0 && !knownRoleRx.test(subNameStr);

  let office_type_special: typeof office_type_extracted = office_type_extracted ?? null;
  if (!row.office_type) {
    if (hasSecretary) office_type_special = "cabinet";
    else if (subNameIsUnknownRole) office_type_special = "official" as any; // per your enum addition
  }

  // 5) compute limit score + tier
  console.log(`[PROFILE_INDEX] Step 5: Computing limit score and tier`);
  let limit_score = row.limit_score as number | null;
  let tier = row.tier as "base" | "soft" | "hard" | null;
  if (limit_score == null || tier == null) {
    const incumbentFinal = (ext.incumbent ?? isIncumbent(text));
    const officeDetected = (office_type_special ?? "candidate") as any;
    const { score, tier: t } = computeLimitScore(text, officeDetected, incumbentFinal ?? false);
    limit_score = score;
    tier = t;
    console.log(`[PROFILE_INDEX] Computed - limit_score: ${limit_score}, tier: ${tier}`);
  } else {
    console.log(`[PROFILE_INDEX] Using existing - limit_score: ${limit_score}, tier: ${tier}`);
  }

  // Force tier base if "former" appears in sub_name (only when filling missing tier)
  if (!row.tier && isFormer) tier = "base";

  // 6) patch only missing fields
  console.log(`[PROFILE_INDEX] Step 6: Updating ppl_index with extracted fields`);
  const patch: any = {};
  if (!row.office_type && office_type_special) patch.office_type = office_type_special;
  if (!row.gov_level && gov_level) patch.gov_level = gov_level;
  if (!row.party_type && party_type) patch.party_type = party_type;
  if (!row.slug && slug) patch.slug = slug;
  if (!row.state_code && state_code) patch.state_code = state_code;
  if (row.limit_score == null && limit_score != null) patch.limit_score = limit_score;
  if (!row.tier && tier) patch.tier = tier;

  if (Object.keys(patch).length) {
    console.log(`[PROFILE_INDEX] Updating ${Object.keys(patch).length} fields:`, patch);
    const { error: upErr } = await supabase.from("ppl_index").update(patch).eq("id", id);
    if (upErr) {
      console.error(`[PROFILE_INDEX] FAIL: Error updating ppl_index:`, upErr);
      throw upErr;
    }
    console.log(`[PROFILE_INDEX] ppl_index update successful`);
  } else {
    console.log(`[PROFILE_INDEX] No fields need updating in ppl_index`);
  }

  console.log(`[PROFILE_INDEX] ===== COMPLETE: Politician ID ${id} processed successfully =====`);
  return { id, updated: patch, url: wikiUrl };
}

/** ========================== legi (congress.gov) with Mistral ========================== */

/** Tavily search */
async function tavilySearch(query: string, includeDomains?: string[]) {
  const body: any = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: 10,
    include_answer: false,
  };
  if (includeDomains?.length) body.include_domains = includeDomains;
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  const data = await res.json();
  const results: { url: string }[] = data.results || [];
  return results.map((r) => r.url);
}

/** Tavily extract (one attempt) */
async function tavilyExtractOne(url: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_API_KEY, urls: [url], format: "markdown" }),
  });
  if (!res.ok) throw new Error(`Tavily extract failed: ${res.status}`);
  const data = await res.json();
  const entry = Array.isArray(data?.results) ? data.results[0] : data?.results?.[0] || data;
  const text: string =
    entry?.markdown || entry?.content || entry?.text || entry?.raw_content || entry?.html || "";
  return typeof text === "string" ? text : "";
}

/** Fallback fetch with a friendly UA (helps with 403) */
async function fetchHTMLWithUA(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Upgrade-Insecure-Requests": "1",
      "Referer": "https://www.congress.gov/",
    },
  });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return await r.text();
}
/** Extra fallback: fetch readable text via Jina Reader proxy (bypasses 403) */
async function fetchViaJinaReader(url: string): Promise<string> {
  const bare = url.replace(/^https?:\/\//i, "");
  const proxied = `https://r.jina.ai/http://${bare}`;
  const r = await fetch(proxied, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "text/plain,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });
  if (!r.ok) throw new Error(`Jina fetch failed ${r.status}`);
  return await r.text();
}


/** Strip HTML to text */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tavily extract with one retry; else HTML+UA; else Jina Reader. Parse full text. */
async function tavilyExtractOneWithRetryOrHtml(
  url: string
): Promise<{ storedText: string; parseText: string; source: "tavily" | "html" | "jina" }> {
  // 1) Tavily attempt #1
  try {
    const t1 = await tavilyExtractOne(url);
    if (t1 && t1.trim()) return { storedText: t1, parseText: t1, source: "tavily" };
  } catch {}

  // 2) Tavily attempt #2
  try {
    const t2 = await tavilyExtractOne(url);
    if (t2 && t2.trim()) return { storedText: t2, parseText: t2, source: "tavily" };
  } catch {}

  // 3) Direct HTML with browser-like headers
  try {
    const html = await fetchHTMLWithUA(url);
    const text = stripHtml(html);
    if (text && text.trim()) return { storedText: html, parseText: text, source: "html" };
  } catch {}

  // 4) Jina Reader proxy (plain text)
  const jinaText = await fetchViaJinaReader(url);
  if (jinaText && jinaText.trim()) {
    return { storedText: jinaText, parseText: jinaText, source: "jina" };
  }

  // Defensive last resort (should rarely hit)
  throw new Error("All extraction fallbacks failed");
}

/** Generic web extractor for arbitrary URLs (not congress.gov-specific) */
async function webExtractOneWithRetry(url: string): Promise<{ storedText: string; parseText: string; source: "tavily"|"html"|"jina" }> {
  // 1) Tavily extract (1–2 tries)
  try {
    const t1 = await tavilyExtractOne(url);
    if (t1 && t1.trim()) return { storedText: t1, parseText: t1, source: "tavily" };
  } catch {}
  try {
    const t2 = await tavilyExtractOne(url);
    if (t2 && t2.trim()) return { storedText: t2, parseText: t2, source: "tavily" };
  } catch {}

  // 2) Direct HTML with a neutral UA (no congress.gov referer)
  try {
    const html = await fetchHTMLWithUA(url /* same UA fn, ok for general use */);
    const text = stripHtml(html);
    if (text && text.trim()) return { storedText: html, parseText: text, source: "html" };
  } catch {}

  // 3) Jina Reader
  const jina = await fetchViaJinaReader(url);
  if (jina && jina.trim()) return { storedText: jina, parseText: jina, source: "jina" };

  throw new Error("All extraction fallbacks failed");
}


/** Normalize any congress.gov bill URL to the ROOT path ending at the bill number.
 *  Example: https://www.congress.gov/bill/119th-congress/senate-bill/146/text
 *  ->       https://www.congress.gov/bill/119th-congress/senate-bill/146
 */
function normalizeToBillRoot(u: string): string | null {
  try {
    const url = new URL(u);
    if (!/^(?:www\.)?congress\.gov$/i.test(url.hostname)) return null;

    // Expect: /bill/{congress}/{type}/{number}[/*...optional...]
    const parts = url.pathname.replace(/\/+$/, "").split("/");
    // parts: ["", "bill", "{congress}", "{type}", "{number}", ...]
    if (parts.length < 5) return null;
    if (parts[1] !== "bill") return null;
    if (!/^\d+(?:st|nd|rd|th)-congress$/i.test(parts[2] || "")) return null;
    if (!/^\d+$/.test(parts[4] || "")) return null;

    // Rebuild exactly up to the bill number
    const rootPath = ["", "bill", parts[2], parts[3], parts[4]].join("/");
    return `https://www.congress.gov${rootPath}`;
  } catch {
    return null;
  }
}

/** Pick the best congress.gov bill candidate and normalize to the ROOT bill URL */
function pickCongressUrlRoot(urls: string[]): string | null {
  const candidates = urls
    .filter((u) => /^https?:\/\/www\.congress\.gov\/bill\//i.test(u))
    .map((u) => normalizeToBillRoot(u))
    .filter((u): u is string => !!u);
  return candidates[0] || null;
}

/** Extract the congress ordinal (e.g., "119th") from a congress.gov bill URL */
function congressFromUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (!/congress\.gov$/i.test(url.hostname)) return null;
    const m = url.pathname.match(/\/bill\/(\d+(?:st|nd|rd|th))-congress\//i);
    return m ? m[1] : null;
  } catch { return null; }
}

/** Bill level: for congress.gov it is nationwide */
function inferBillLevelFromUrl(u?: string): "nationwide" | "statewide" | "local" {
  try {
    const host = u ? new URL(u).host.toLowerCase() : "";
    if (/congress\.gov|house\.gov|senate\.gov|govinfo\.gov/.test(host)) return "nationwide";
  } catch {}
  return "nationwide";
}

/** Date helpers */
const DATE_RE = /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4})\b/g;

function normalizeDateISO(s: string): string | undefined {
  try {
    const d = new Date(s);
    if (isNaN(+d)) return undefined;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch { return undefined; }
}

function pickBillDateISO(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const latestLine = lines.find((ln) => /Latest Action:/i.test(ln));
  if (latestLine) {
    const dates = Array.from(latestLine.matchAll(DATE_RE)).map((m) => normalizeDateISO(m[0])).filter(Boolean) as string[];
    if (dates.length) return dates.sort().at(-1);
  }
  const introLine = lines.find((ln) => /Introduced/i.test(ln));
  if (introLine) {
    const dates = Array.from(introLine.matchAll(DATE_RE)).map((m) => normalizeDateISO(m[0])).filter(Boolean) as string[];
    if (dates.length) return dates.sort().at(-1);
  }
  const anyDates = Array.from(text.matchAll(DATE_RE)).map((m) => normalizeDateISO(m[0])).filter(Boolean) as string[];
  if (anyDates.length) return anyDates.sort().at(-1);
  return undefined;
}

/** Fallback sponsor extraction (regex only) */
function extractSponsorDisplay(parseBase: string): string | undefined {
  const lines = parseBase.split(/\r?\n/);
  const sponsorLine = lines.find((ln) => /\bSponsor:\b/i.test(ln));
  let cellText = "";
  if (sponsorLine) {
    const cells = sponsorLine.split("|").map((c) => c.trim()).filter(Boolean);
    const idx = cells.findIndex((c) => /^Sponsor:$/i.test(c));
    if (idx >= 0 && cells[idx + 1]) {
      cellText = cells[idx + 1];
    } else {
      cellText = sponsorLine.replace(/^[^:]*:\s*/i, "");
    }
  } else {
    const m = parseBase.match(/\[[RDI]-(?:AS|DC|GU|MP|PR|VI|[A-Z]{2})(?:-(?:At(?:[ -]?Large)|\d{1,3}))?\]/i);
    if (m) {
      const start = Math.max(0, (m.index ?? 0) - 160);
      const end = Math.min(parseBase.length, (m.index ?? 0) + 160);
      cellText = parseBase.slice(start, end);
    } else {
      return undefined;
    }
  }
  cellText = cellText.split("\n")[0];
  cellText = cellText.replace(/\]\([^)]+\)/g, "]");
  if (cellText.startsWith("[") && cellText.endsWith("]")) cellText = cellText.slice(1, -1);
  cellText = cellText.replace(/\s*\(.*?\)\s*$/, "").trim();
  const bracketMatch = cellText.match(/\[([RDI])-(AS|DC|GU|MP|PR|VI|[A-Z]{2})(?:-(?:At-Large|\d{1,3}))?\]/i);
  const party = bracketMatch?.[1]?.toUpperCase();
  const state = bracketMatch?.[2]?.toUpperCase();
  const bracketPretty = (party && state) ? `(${party}-${state})` : undefined;
  let nameRaw = bracketMatch ? cellText.replace(bracketMatch[0], "").trim() : cellText;
  nameRaw = nameRaw.replace(/^(Rep\.|Sen\.|Del\.|Resident Commissioner)\s*/i, "").trim();
  if (/,/.test(nameRaw)) {
    const last = nameRaw.split(",")[0].trim();
    const first = nameRaw.slice(nameRaw.indexOf(",") + 1).trim();
    if (first && last) nameRaw = `${first} ${last}`;
  }
  nameRaw = nameRaw.replace(/\s+/g, " ").trim();
  if (!nameRaw) return undefined;
  return bracketPretty ? `${nameRaw} ${bracketPretty}` : nameRaw;
}

/** Use Mistral to extract bill_status + sub_name components */
async function mistralExtractLegi(text: string) {
  const sys = `You are a precise data extractor. Return ONLY JSON. Do not guess unknown fields.`;
  const usr = `
TEXT (first page excerpt):
"""${text.slice(0, PART_LEN)}"""

Extract the following as JSON:

{
  "bill_status": "processing" | "failed" | "passed" | null,
  "date_pretty": "Month D, YYYY" | null,
  "sponsor_name": "First M. Last" | null,
  "sponsor_party": "R" | "D" | "I" | null,
  "sponsor_state": "AL|AK|...|DC|PR|VI|GU|AS|MP" | null
}

Rules:
- "bill_status": read the most recent / Latest Action context. If the bill became law (e.g., "Became Public Law", "Signed by the President"), use "passed". If it was vetoed and not overridden, or explicitly failed/defeated/died, use "failed". Otherwise "processing".
- "date_pretty": Prefer the date on the "Latest Action" line. If missing, use the "Introduced" date. Format as "Month D, YYYY".
- "sponsor_*": Use the Sponsor row. Exclude titles like "Rep.", "Sen.", "Del.", "Resident Commissioner". Party must be a single letter R/D/I. State is a two-letter code (including DC/PR/VI/ GU/AS/MP). If a district is present (e.g., "-12" or "At-Large"), ignore it and keep only the two-letter state.
- Do not include any extra keys. Missing fields should be null.`;

  const j = await mistralJSON(sys, usr, 600);
  return {
    bill_status: (j?.bill_status ?? null) as "processing" | "failed" | "passed" | null,
    date_pretty: (j?.date_pretty ?? null) as string | null,
    sponsor_name: (j?.sponsor_name ?? null) as string | null,
    sponsor_party: (j?.sponsor_party ?? null) as string | null,
    sponsor_state: (j?.sponsor_state ?? null) as string | null,
  };
}

/** Map congress.gov path segment to canonical bill code prefix */
function billIdFromCongressUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (!/congress\.gov$/i.test(url.hostname)) return null;
    // Expect: /bill/{118th-congress}/{type}/{number}[/*optional]
    const parts = url.pathname.replace(/\/+$/, "").split("/");
    // parts: ["", "bill", "{congress}", "{type}", "{number}", ...]
    const type = (parts[3] || "").toLowerCase();
    const num = parts[4];
    if (!/^\d+$/.test(num || "")) return null;

    const map: Record<string,string> = {
      "house-bill": "H.R.",
      "senate-bill": "S.",
      "house-joint-resolution": "H.J.Res.",
      "senate-joint-resolution": "S.J.Res.",
      "house-concurrent-resolution": "H.Con.Res.",
      "senate-concurrent-resolution": "S.Con.Res.",
      "house-resolution": "H.Res.",
      "senate-resolution": "S.Res.",
      "house-simple-resolution": "H.Res.",
      "senate-simple-resolution": "S.Res."
    };
    const prefix = map[type];
    if (!prefix) return null;
    return `${prefix}${num}`;
  } catch {
    return null;
  }
}

/** --------- NEW: Storage-first helpers for legislation synopses --------- */
/** List existing synopsis files under legi/{id}/ that contain "synopsis" and end with .txt.
 *  Supports single-part (e.g., synopsis.669.congress.txt) and multi-part (e.g., synopsis.669.congress.1.txt, .2.txt).
 */
async function listStoredLegiSynopsisPaths(id: number): Promise<string[]> {
  const prefix = `legi/${id}`;
  const { data, error } = await supabase.storage
    .from(WEB_BUCKET)
    .list(prefix, { limit: 500, sortBy: { column: "name", order: "asc" } });
  if (error || !data) return [];

  // Only filenames that have "synopsis" and end with .txt
  const candidates = data
    .filter(f => /synopsis/i.test(f.name) && /\.txt$/i.test(f.name))
    .map(f => `${prefix}/${f.name}`);

  if (!candidates.length) return [];

  // Group parts by base name (normalize ".N.txt" to ".txt")
  const groups = new Map<string, string[]>();
  for (const p of candidates) {
    const base = p.replace(/\.\d+\.txt$/i, ".txt");
    const arr = groups.get(base) || [];
    arr.push(p);
    groups.set(base, arr);
  }

  // Prefer the group with the highest numeric "webId" after "synopsis."
  const bases = [...groups.keys()].sort((a, b) => {
    const ax = a.match(/synopsis\.(\d+)\./i)?.[1];
    const bx = b.match(/synopsis\.(\d+)\./i)?.[1];
    return (Number(ax) || 0) - (Number(bx) || 0);
  });
  const chosenBase = bases.pop();
  if (!chosenBase) return [];

  // Sort parts by trailing index (.1.txt, .2.txt ...), defaulting single-file to index 1
  const parts = (groups.get(chosenBase) || []).sort((a, b) => {
    const ai = a.match(/\.([0-9]+)\.txt$/)?.[1] ? Number(a.match(/\.([0-9]+)\.txt$/)![1]) : 1;
    const bi = b.match(/\.([0-9]+)\.txt$/)?.[1] ? Number(b.match(/\.([0-9]+)\.txt$/)![1]) : 1;
    return ai - bi;
  });

  return parts;
}

/** Try to recover the most recent saved link for this legi id from web_content. */
async function latestLegiWebContentLink(id: number): Promise<string|undefined> {
  const { data, error } = await supabase
    .from("web_content")
    .select("id, link")
    .eq("owner_id", id)
    .eq("is_ppl", false)
    .order("id", { ascending: false })
    .limit(1);
  if (error || !data || !data[0]) return undefined;
  return data[0].link || undefined;
}

/** Main handler for legislation */
async function handleLegiById(id: number, conc: number) {
  // 0) Update weekly visits tracking
  await updateWeeklyVisits("legi_index", id);
  
  // 1) fetch legi row
  const { data: row, error } = await supabase.from("legi_index").select("*").eq("id", id).single();
  if (error || !row) throw new Error(`legi_index id ${id} not found`);
  let storedPaths: string[] = [];
  let extractedStored = "";
  let parseBase = "";
  let urlUsed = "";
  let storedNewContent = false; // Track if new content was stored

  // Always fetch new content regardless of existing data
  const name: string = row.name || row.title || row.bill_name || row.slug;
  if (!name) throw new Error(`legi_index id ${id} has no name/title to search.`);

  // ================== SMALL ADDITION (legislation query tweak) ==================
  const congressHint = (typeof row.congress === "string" && row.congress.trim()) ? row.congress.trim() : null;
  const collapsed = name.toLowerCase().replace(/[^a-z0-9]/g, ""); // "H.Res.537" -> "hres537"
  const query = congressHint ? `${collapsed} ${congressHint}` : `${name} site:congress.gov`;
  // Search congress.gov only and normalize to the ROOT bill URL
  const urls = await tavilySearch(query, ["congress.gov"]);
  const pick = pickCongressUrlRoot(urls);
  if (!pick) throw new Error(`No valid congress.gov bill URL found for "${name}".`);
  urlUsed = pick;

  // Extract (retry once), else HTML+UA
  const ext = await tavilyExtractOneWithRetryOrHtml(urlUsed);
  extractedStored = ext.storedText;
  parseBase = ext.parseText;

  // Create web_content row first to fit your path convention — include link now
  const insert = await supabase
    .from("web_content")
    .insert({ path: "pending", owner_id: id, is_ppl: false, link: urlUsed })
    .select("id")
    .single();
  if (insert.error || !insert.data) throw insert.error || new Error("web_content insert failed");
  const webId = insert.data.id as number;

  // Store to storage: legi/[id]/synopsis.[webId].congress[.part].txt
  const base = `legi/${id}/synopsis.${webId}.congress`;
  storedPaths = await putParts(base, extractedStored, conc);
  storedNewContent = true; // Track that new content was stored

  // Update web_content.path to point at the first part (link already set on insert)
  await supabase.from("web_content").update({ path: storedPaths[0] }).eq("id", webId);

  // ---------- Use Mistral to extract fields ----------
  let bill_status: "processing" | "failed" | "passed" | null = null;
  let sub_name: string | undefined;

  try {
    const m = await mistralExtractLegi(parseBase);
    bill_status = m.bill_status ?? null;

    // Build sub_name using Mistral fields; fallback if any piece missing
    let datePretty = m.date_pretty ?? undefined;
    if (!datePretty) {
      const iso = pickBillDateISO(parseBase);
      if (iso) datePretty = new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }

    const party = (m.sponsor_party || "").toUpperCase();
    const state = (m.sponsor_state || "").toUpperCase();
    const nameClean = (m.sponsor_name || "").trim();

    if (datePretty && nameClean && party && state && /^[RDI]$/.test(party) && /^[A-Z]{2}$/.test(state)) {
      sub_name = `${datePretty} | ${nameClean} (${party}-${state})`;
    } else {
      // Fallback: regex sponsor + picked date
      const sponsorDisplay = extractSponsorDisplay(parseBase);
      if (datePretty && sponsorDisplay) sub_name = `${datePretty} | ${sponsorDisplay}`;
    }
  } catch {
    // Total fallback if Mistral fails entirely
    const iso = pickBillDateISO(parseBase);
    const datePretty = iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : undefined;
    const sponsorDisplay = extractSponsorDisplay(parseBase);
    if (datePretty && sponsorDisplay) sub_name = `${datePretty} | ${sponsorDisplay}`;
  }

  const bill_lvl = inferBillLevelFromUrl(urlUsed);

  // --- bill_id derived from congress.gov root URL ---
  const bill_id = billIdFromCongressUrl(urlUsed) || null;

  // --- NEW: congress ordinal (e.g., "119th") derived from URL ---
  const congressText = congressFromUrl(urlUsed); // must look like "119th"

  // ---------- persist ----------
  const patch: Record<string, any> = {};
  if (!row.bill_lvl && bill_lvl) patch.bill_lvl = bill_lvl;
  if (!row.sub_name && sub_name) patch.sub_name = sub_name;
  if (!row.bill_status && bill_status) patch.bill_status = bill_status;
  if (!row.bill_id && bill_id) patch.bill_id = bill_id;
  if (!row.congress && congressText) patch.congress = congressText;

  if (Object.keys(patch).length) {
    const { error: upErr } = await supabase.from("legi_index").update(patch).eq("id", id);
    if (upErr) throw upErr;
  }

  // Update indexed status based on legi_profiles completion
  await updateLegislationIndexedStatus(id);

  return { id, updated: patch, url: urlUsed, stored_paths: storedPaths };
}

/** ========================== HTTP HANDLER ========================== */
Deno.serve(async (req) => {
  try {
    const CONC = resolveConcurrency(req); // per-request slider value

    if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("health") === "1") return new Response("ok", { status: 200 });
      return new Response("profile_index: POST { id, is_ppl }", { status: 200 });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ctype = req.headers.get("content-type") || "";
    const body = ctype.includes("application/json") ? await req.json().catch(() => ({})) : {};
    const { id, is_ppl } = body as { id?: number; is_ppl?: boolean };

    if (typeof id !== "number" || typeof is_ppl !== "boolean") {
      return new Response(JSON.stringify({ error: "Body must include { id:number, is_ppl:boolean }" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pass CONC down:
    const result = is_ppl ? await handlePersonById(id, CONC) : await handleLegiById(id, CONC);

    return new Response(JSON.stringify({ ok: true, concurrency: CONC, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
