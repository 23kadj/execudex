/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";

/** Wikipedia */
const PART_LEN = 110_000; // split stored pages into ~110k-char parts
const WIKI_TIMEOUT_MS = Number(Deno.env.get("WIKI_TIMEOUT_MS") ?? 15000);

const MISTRAL_MODEL = "mistral-small-latest";

/** Prefer “most common name” over odd formal variants (default: true) */
const PREFER_COMMON_NAME = (Deno.env.get("PPL_PREFER_COMMON_NAME") ?? "true").toLowerCase() !== "false";

/** ========================== CONCURRENCY "SLIDER" ========================== */
const CONCURRENCY = Number(Deno.env.get("PPL_SEARCH_CONCURRENCY") ?? 15);

async function withLimit<T>(limit: number, tasks: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return results;
}

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== HELPERS ========================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round2 = (x: number) => Number(x.toFixed(2));

function dropMiddleNamesKeepInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  const first = parts[0];
  const last  = parts[parts.length - 1];
  const mids = parts.slice(1, -1).filter(p => /^[A-Za-z]\.$/.test(p));
  return [first, ...mids, last].join(" ");
}

function titleCaseNamePreserveInitials(name: string): string {
  return name.split(/\s+/).map(tok => {
    if (/^[A-Za-z]\.$/.test(tok)) return tok.toUpperCase();
    const lower = tok.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
}

function normalizeForCompare(name: string): string {
  return dropMiddleNamesKeepInitials(name)
    .replace(/[^\p{L}\p{N}\s\.]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function tavilySearch(query: string, max = 10): Promise<string[]> {
  const body: any = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: max,
    include_answer: false
  };
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  const j = await res.json();
  const urls: string[] = (j?.results || []).map((r: any) => r?.url).filter(Boolean);
  return urls;
}

async function tavilyExtract(url: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_API_KEY, urls: [url], format: "markdown" })
  });
  if (!res.ok) throw new Error(`Tavily extract failed: ${res.status}`);
  const data = await res.json();
  const entry = Array.isArray(data?.results) ? data.results[0] : data?.results?.[0] || data;
  const txt: string = entry?.markdown || entry?.content || entry?.text || entry?.raw_content || entry?.html || "";
  return typeof txt === "string" ? txt : "";
}

async function extractWithRetry(url: string): Promise<string> {
  try {
    return await tavilyExtract(url);
  } catch {
    await sleep(300);
    return await tavilyExtract(url);
  }
}

function hardTrim(s: string, max = PART_LEN): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/** ========================== NAME CHOICE (COMMON NAME) ========================== */

const SUFFIXES = new Set([
  "jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"
]);

/** Pull a human title from a Wikipedia URL path (e.g., .../wiki/Joe_Biden -> "Joe Biden") */
function wikipediaTitleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/wikipedia\.org$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/wiki\/([^#?]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]).replace(/_/g, " ").trim();
  } catch { return null; }
}

/** Get last name token (ignore suffix tokens like Jr., Sr.) */
function getLastNameToken(name: string): string | null {
  const toks = name.trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0) return null;
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i].replace(/\./g, "").toLowerCase();
    if (!SUFFIXES.has(t)) return toks[i];
  }
  return null;
}

/** Count case-insensitive occurrences of a candidate across all texts */
function countOccurrences(candidate: string, texts: string[]): number {
  if (!candidate) return 0;
  const c = candidate.trim();
  if (!c) return 0;
  const rx = new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let total = 0;
  for (const t of texts) {
    if (!t) continue;
    const matches = t.match(rx);
    if (matches) total += matches.length;
  }
  return total;
}

/** Build a best canonical name using common-name heuristics (Wikipedia > frequency > input) */
function chooseCanonicalName(
  mx: MxDecision | null,
  text_input: string,
  corpus: {url: string; text: string}[]
): string {
  const candidates = new Set<string>();
  if (text_input) candidates.add(text_input);
  if (mx?.canonical_name) candidates.add(mx.canonical_name);
  for (const v of (mx?.name_variants || [])) if (v) candidates.add(v);
  for (const c of corpus) {
    const wt = wikipediaTitleFromUrl(c.url);
    if (wt) candidates.add(wt);
  }
  let candList = Array.from(candidates)
    .map(s => titleCaseNamePreserveInitials(dropMiddleNamesKeepInitials(s)))
    .filter(Boolean);

  const inputLast = getLastNameToken(text_input || "")?.toLowerCase();
  candList = candList.filter(c => {
    const toks = c.trim().split(/\s+/).filter(Boolean);
    if (toks.length < 2) return false;
    const lastTok = getLastNameToken(c);
    if (!lastTok) return false;
    if (inputLast) {
      const hasInputLast = toks.some(t => t.replace(/\./g,"").toLowerCase() === inputLast);
      if (!hasInputLast) {
        const looksWikiLike = !!corpus.find(k => {
          const wt = wikipediaTitleFromUrl(k.url);
          return wt && titleCaseNamePreserveInitials(dropMiddleNamesKeepInitials(wt)) === c;
        });
        if (!looksWikiLike) return false;
      }
    }
    return true;
  });

  if (!candList.length) {
    return titleCaseNamePreserveInitials(dropMiddleNamesKeepInitials(mx?.canonical_name || text_input));
  }

  if (!PREFER_COMMON_NAME) {
    const preferred = (mx?.canonical_name && candList.find(c => c === titleCaseNamePreserveInitials(dropMiddleNamesKeepInitials(mx.canonical_name!))))
      || candList.find(c => c.toLowerCase() === (text_input || "").toLowerCase())
      || candList[0];
    return preferred!;
  }

  for (const c of candList) {
    const isWikiTitle = corpus.some(k => {
      const wt = wikipediaTitleFromUrl(k.url);
      if (!wt) return false;
      const normWt = titleCaseNamePreserveInitials(dropMiddleNamesKeepInitials(wt));
      return normWt === c;
    });
    if (isWikiTitle) return c;
  }

  const texts = corpus.map(c => c.text || "");
  let best = candList[0], bestScore = -1;
  for (const c of candList) {
    let score = countOccurrences(c, texts);
    if (text_input && c.toLowerCase() === text_input.toLowerCase()) score += 1.5;
    score += Math.max(0, 3 - c.split(/\s+/).length) * 0.25;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/** ========================== MODEL TYPES ========================== */

type MxDecision = {
  us_based: boolean | null;
  is_candidate: boolean | null;
  office_type: "president"|"vice_president"|"senator"|"representative"|"governor"|"mayor"|"cabinet"|"official"|null;
  status: "current"|"former"|null;
  state_code: string | null;
  city_name: string | null;           // for mayors
  canonical_name: string | null;
  name_variants: string[];
  cabinet_role: string | null;
};

/** Prefer found office over clicked category; still use clicked as hint */
function pickOfficeType(found: MxDecision["office_type"], hint: string | null): MxDecision["office_type"] {
  const VALID = new Set(["president","vice_president","senator","representative","governor","mayor","cabinet","official"]);
  if (found && VALID.has(found)) return found;
  if (hint && VALID.has(hint as any)) return hint as any;
  return null;
}

async function mistralDecide(corpus: {url:string,text:string}[], text_input: string, office_hint: string): Promise<MxDecision> {
  const sys = `You are a strict US-politics validator. Return ONLY JSON. Do not invent facts.`;
  const user = `
INPUT_NAME: ${text_input}
OFFICE_HINT: ${office_hint}

You are given up to three sources (markdown/plain text) that may describe this person. Decide if the person is a US politician (current or former) OR is clearly a political candidate. Ignore non-US figures.

Return JSON with keys:
{
  "us_based": true|false|null,
  "is_candidate": true|false|null,
  "office_type": "president"|"vice_president"|"senator"|"representative"|"governor"|"mayor"|"cabinet"|"official"|null,
  "status": "current"|"former"|null,
  "state_code": "<US two-letter code or DC>" | null,
  "city_name": "<City name if Mayor, else null>" | null,
  "canonical_name": "<First M. Last or First Last>" | null,
  "name_variants": ["...","..."],
  "cabinet_role": "<Exact cabinet position title like 'Secretary of State'>" | null
}

Rules:
- "us_based": true only if the person holds/held US public office or is running for a US office. If mainly outside the US, set false.
- Prefer returning the real, specific office from sources even if OFFICE_HINT differs.
- Mark "is_candidate": true ONLY if NONE of the provided sources indicate a current or former office. If any source indicates the person currently holds/held office, set "is_candidate": false.
- If office_type is "mayor", fill "city_name" with the city (e.g., "Hagerstown"), else null.
- If insufficient evidence, prefer nulls.
SOURCES:
${corpus.map((c,i)=>`[${i+1}] URL: ${c.url}\nTEXT:\n"""${c.text}"""`).join("\n\n")}
`;
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      temperature: 0.0,
      response_format: { type: "json_object" },
      max_tokens: 750,
      messages: [{ role:"system", content: sys }, { role:"user", content: user }]
    })
  });
  if (!r.ok) throw new Error(`Mistral error ${r.status}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content);
    return {
      us_based: parsed?.us_based ?? null,
      is_candidate: parsed?.is_candidate ?? null,
      office_type: parsed?.office_type ?? null,
      status: parsed?.status ?? null,
      state_code: parsed?.state_code ?? null,
      city_name: typeof parsed?.city_name === "string" ? parsed.city_name : null,
      canonical_name: parsed?.canonical_name ?? null,
      name_variants: Array.isArray(parsed?.name_variants) ? parsed.name_variants : [],
      cabinet_role: typeof parsed?.cabinet_role === "string" ? parsed.cabinet_role : null,
    };
  } catch {
    return {
      us_based:null, is_candidate:null, office_type:null, status:null,
      state_code:null, city_name:null, canonical_name:null, name_variants: [], cabinet_role: null
    };
  }
}

/** Label map includes "official" + mayor city handling */
function subNameFromDecision(mx: MxDecision, office_hint: string | null): string | null {
  const resolvedOffice = pickOfficeType(mx.office_type, office_hint);
  const status = mx.status;
  const st = (mx.state_code || "").toUpperCase();
  const city = (mx.city_name || "").trim();

  const officeLabel = (o: string) => {
    switch (o) {
      case "president": return "President";
      case "vice_president": return "Vice President";
      case "senator": return "Senator";
      case "representative": return "Representative";
      case "governor": return "Governor";
      case "mayor": return "Mayor";
      case "cabinet": return "Cabinet";
      case "official": return "Official";
      default: return null;
    }
  };

  const hasOffice = !!resolvedOffice && (status === "current" || status === "former");

  if (mx.is_candidate && !hasOffice) return "Political Candidate";
  if (!hasOffice) return "Politician";

  if (resolvedOffice === "mayor") {
    if (status === "former") return city ? `Former Mayor of ${city}` : `Former Mayor`;
    if (status === "current") return city ? `Mayor of ${city}` : `Mayor`;
  }

  if (resolvedOffice === "cabinet") {
    if (status === "former") return "Former Cabinet Member";
    if (status === "current") {
      const role = (mx.cabinet_role || "").trim();
      return role ? role : "Cabinet";
    }
  }

  if (status === "former" && resolvedOffice) {
    const label = officeLabel(resolvedOffice);
    if (label) return `Former ${label}`;
  }

  if (status === "current") {
    if (resolvedOffice === "senator" && st) return `Senator of ${stateFromCode(st) ?? st}`;
    if (resolvedOffice === "representative" && st) return `Representative of ${stateFromCode(st) ?? st}`;
    if (resolvedOffice === "governor" && st) return `Governor of ${stateFromCode(st) ?? st}`;
    if (resolvedOffice === "president") return "President of the United States";
    if (resolvedOffice === "vice_president") return "Vice President of the United States";
    const label = resolvedOffice ? officeLabel(resolvedOffice) : null;
    if (label) return label;
  }

  return "Politician";
}

const STATE_NAMES: Record<string,string> = {
  AL:"Alabama", AK:"Alaska", AZ:"Arizona", AR:"Arkansas", CA:"California", CO:"Colorado", CT:"Connecticut", DE:"Delaware",
  FL:"Florida", GA:"Georgia", HI:"Hawaii", ID:"Idaho", IL:"Illinois", IN:"Indiana", IA:"Iowa", KS:"Kansas", KY:"Kentucky",
  LA:"Louisiana", ME:"Maine", MD:"Maryland", MA:"Massachusetts", MI:"Michigan", MN:"Minnesota", MS:"Mississippi", MO:"Missouri",
  MT:"Montana", NE:"Nebraska", NV:"Nevada", NH:"New Hampshire", NJ:"New Jersey", NM:"New Mexico", NY:"New York",
  NC:"North Carolina", ND:"North Dakota", OH:"Ohio", OK:"Oklahoma", OR:"Oregon", PA:"Pennsylvania", RI:"Rhode Island",
  SC:"South Carolina", SD:"South Dakota", TN:"Tennessee", TX:"Texas", UT:"Utah", VT:"Vermont", VA:"Virginia",
  WA:"Washington", WV:"West Virginia", WI:"Wisconsin", WY:"Wyoming", DC:"District of Columbia", PR:"Puerto Rico",
  VI:"U.S. Virgin Islands", GU:"Guam", AS:"American Samoa", MP:"Northern Mariana Islands"
};
function stateFromCode(code: string): string | undefined { return STATE_NAMES[code.toUpperCase()]; }

/** Dedup check (parallel, bounded by CONCURRENCY) */
async function isDuplicate(variants: string[]): Promise<boolean> {
  const uniq = Array.from(new Set(variants.map(v => v || "").filter(Boolean)));
  if (!uniq.length) return false;

  const tasks = uniq.map(v => async () => {
    const norm = normalizeForCompare(v);
    const toks = norm.split(" ").filter(Boolean);
    if (toks.length < 2) return false;
    const first = toks[0], last = toks[toks.length - 1];

    const { data, error } = await supabase
      .from("ppl_index")
      .select("name")
      .ilike("name", `%${first}%`)
      .ilike("name", `%${last}%`)
      .limit(5);

    if (error) return false;

    for (const row of (data || [])) {
      const existing = normalizeForCompare(row.name || "");
      if (existing === normalizeForCompare(dropMiddleNamesKeepInitials(v))) return true;
    }
    return false;
  });

  const results = await withLimit<boolean>(CONCURRENCY, tasks);
  return results.some(Boolean);
}

/** Find the lowest unused positive integer id in ppl_index, scanning in pages */
async function findLowestUnusedId(): Promise<number> {
  const PAGE = 10000;
  let expected = 1;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ppl_index")
      .select("id")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return expected;
    for (const row of data) {
      const id = Number(row.id);
      if (Number.isNaN(id)) continue;
      if (id === expected) expected++;
      else if (id > expected) return expected;
    }
    offset += PAGE;
  }
}

/** ========================== WIKIPEDIA HELPERS ========================== */
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
async function withTinyRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (_e) { await sleep(300 + Math.floor(Math.random() * 300)); return await fn(); }
}
function nameToKey(name: string) { return name.trim().replace(/\s+/g, "_"); }

async function fetchWikiPlainByTitle(title: string) {
  try {
    return await withTinyRetry(() =>
      fetchTEXT(`https://en.wikipedia.org/api/rest_v1/page/plain/${encodeURIComponent(title)}`)
    );
  } catch (_) {
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
function roleHintFromSubName(sub_name?: string | null) {
  if (!sub_name) return "politician";
  const t = sub_name.toLowerCase();
  if (/\bvice\s*president\b/.test(t)) return "vice president";
  if (/\bpresident\b/.test(t)) return "president";
  if (/\bsenator\b/.test(t)) return "senator";
  if (/\brepresentative\b|\bcongress(wo)?man\b|\bmember of the u\.?s\.? house\b/.test(t)) return "representative";
  if (/\bgovernor\b/.test(t)) return "governor";
  if (/\bmayor\b/.test(t)) return "mayor";
  if (/\bsecretary of\b|\bcabinet\b/.test(t)) return "cabinet";
  if (/\bcandidate\b|\brunning for\b|\bexploratory committee\b/.test(t)) return "candidate";
  return "politician";
}
async function fetchWikipediaText(name: string, sub_name?: string | null): Promise<{ text: string; url: string }> {
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
  } catch {}
  const hint = roleHintFromSubName(sub_name);
  const queries = [`${name} ${hint}`, `${name} politician`, name];
  for (const q of queries) {
    try {
      const rest: any = await withTinyRetry(() =>
        fetchJSON(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=3`)
      );
      const pages = rest?.pages || [];
      for (const p of pages) {
        const candKey = p?.key || p?.title;
        if (!candKey) continue;
        try {
          const sum: any = await withTinyRetry(() =>
            fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candKey)}`)
          );
          if (sum?.type === "disambiguation") continue;
          const title = sum?.title || p?.title;
          const txt = await fetchWikiPlainByTitle(title);
          if (txt && txt.length > 200) {
            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
            return { text: txt, url };
          }
        } catch {}
      }
    } catch {}
  }
  throw new Error(`Wikipedia not found for "${name}"`);
}
async function putParts(basePath: string, content: string): Promise<string[]> {
  const parts: string[] = [];
  for (let i = 0; i < content.length; i += PART_LEN) parts.push(content.slice(i, i + PART_LEN));
  if (parts.length === 1) {
    const path = `${basePath}.txt`;
    const { error } = await supabase.storage
      .from(WEB_BUCKET)
      .upload(path, new Blob([parts[0]], { type: "text/plain; charset=utf-8" }), {
        upsert: true, contentType: "text/plain; charset=utf-8",
      });
    if (error) throw error;
    return [path];
  }
  const paths = parts.map((_, idx) => `${basePath}.${idx + 1}.txt`);
  await Promise.all(
    parts.map((part, idx) =>
      supabase.storage
        .from(WEB_BUCKET)
        .upload(paths[idx], new Blob([part], { type: "text/plain; charset=utf-8" }), {
          upsert: true, contentType: "text/plain; charset=utf-8",
        })
    )
  );
  return paths;
}

/** ========================== TEXT EXTRACTORS (profile-index parity) ========================== */
function normalizeWS(s: string) { return s.replace(/\r/g, ""); }
function detectOfficeType(text: string):
  "president"|"vice_president"|"senator"|"representative"|"governor"|"mayor"|"cabinet"|"candidate"|null {
  const t = text.toLowerCase();
  if (/\bpresident of the united states\b/.test(t)) return "president";
  if (/\bvice president of the united states\b/.test(t)) return "vice_president";
  if (/\b(united states senator|u\.s\. senator|us senator)\b/.test(t)) return "senator";
  if (/\b(united states representative|u\.s\. representative|us representative|member of the u\.s\. house)\b/.test(t)) return "representative";
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
  if (office === "candidate" || office === "representative" || office === "mayor") return "city";
  return null;
}
function detectPartyType(text: string): "R"|"D"|"I"|"other"|null {
  const t = text.toLowerCase();
  if (/\b(republican party|republican)\b/.test(t)) return "R";
  if (/\b(democratic party|democrat)\b/.test(t)) return "D";
  if (/\b(independent)\b/.test(t)) return "I";
  return "other";
}
function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, "-");
}
const STATE_CODES: Record<string,string> = Object.fromEntries(Object.entries(STATE_NAMES).map(([n,c])=>[n,c]));
function findStateCode(text: string, office: string | null): string | null {
  if (!office) return null;
  if (!(office === "representative" || office === "senator" || office === "governor" || office === "mayor")) return null;
  for (const [state, code] of Object.entries(STATE_CODES)) {
    const pat = new RegExp(`\\b(from|of) ${state.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "i");
    if (pat.test(text)) return code;
  }
  for (const [state, code] of Object.entries(STATE_CODES)) {
    const pat = new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "i");
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
  const now = new Date();
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
async function mistralExtractPerson(name: string, slice: string, role_hint: string): Promise<PersonExtract> {
  const sys = `You are a strict information extractor. Return ONLY JSON. Use ONLY facts present in the provided text.`;
  const usr = `
PERSON: ${name}
ROLE_HINT: ${role_hint}
TEXT (lead + office lines):
"""${slice}"""
Return JSON:
{
  "office_type": "president"|"vice_president"|"senator"|"representative"|"governor"|"mayor"|"cabinet"|"candidate"|null,
  "party_type": "R"|"D"|"I"|"other"|null,
  "state_name": "<full state or DC>" | null,
  "state_code": "<two-letter>" | null,
  "incumbent": true|false|null,
  "evidence": { "office": "...", "party": "...", "state": "..." }
}`;
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
      const srx = new RegExp(`\\b(${state.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}|${code})\\b`, "i");
      if (srx.test(ln)) return code;
    }
  }
  return null;
}
async function extractPersonFields(
  name: string,
  fullText: string,
  sub_name?: string | null
): Promise<{ office_type: PersonExtract["office_type"]; party_type: PersonExtract["party_type"]; state_code: string|null; incumbent: boolean; confidence: number; source: "mistral"|"deterministic"; }> {
  const slice = sliceForPersonExtraction(fullText);
  const hint = roleHintFromSubName(sub_name);
  let mx: PersonExtract | null = null;
  try { mx = await mistralExtractPerson(name, slice, hint); } catch { mx = null; }
  const detOffice = detectOfficeType(slice);
  const detParty = detectPartyType(slice);
  const detStateNear = findStateCodeNearOffice(slice, detOffice);
  const inc = isIncumbent(slice);
  const houseCues = /(at-large congressional district|Member of the (U\.S\. )?House|United States Representative|Congress(woman|man))/i.test(slice);
  const officeAfterOverride =
    (mx?.office_type ?? detOffice) === "senator" && houseCues ? "representative" :
    (mx?.office_type ?? detOffice);
  const fromMxCode =
    (mx?.state_code && /^[A-Z]{2}$/.test(mx.state_code)) ? mx.state_code :
    (mx?.state_name && STATE_CODES[mx.state_name] ? STATE_CODES[mx.state_name] : null);
  let state_code = fromMxCode ?? detStateNear ?? findStateCode(slice, officeAfterOverride);
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
  confidence = clamp01(confidence);
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
  const base: Record<string, number> = {
    president: 0.95, vice_president: 0.85, senator: 0.6, governor: 0.5,
    representative: 0.35, mayor: 0.2, cabinet: 0.3, candidate: 0.18,
  };
  let P1 = base[office ?? "candidate"] ?? 0.18;
  const boosts: Array<RegExp | number> = [
    /\bSpeaker of the House\b/i,0.2, /\b(Majority|Minority)\s+Leader\b/i,0.12,
    /\bWhip\b/i,0.08, /\b(Committee|Subcommittee)\s+(Chair|Chairman|Chairwoman)\b/i,0.08,
    /\bRanking Member\b/i,0.05, /\b(Conference|Caucus)\s+(Chair|Co[- ]Chair)\b/i,0.04,
  ];
  let add = 0;
  for (let i = 0; i < boosts.length; i += 2) {
    const rx = boosts[i] as RegExp;
    const val = boosts[i + 1] as number;
    if (rx.test(T)) add += val;
  }
  P1 = clamp01(P1 + Math.min(add, 0.2));

  const yrs = parseYearsInCurrentRole(T);
  const P2 = clamp01(yrs ? Math.min(yrs, 12) / 12 : 0);

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

  const yearCount = (T.match(/\b(19|20)\d{2}\b/g) || []).length;
  const mediaWords = ["Twitter","X (formerly","Instagram","TikTok","YouTube","television","TV","media","press","headline","viral","controversy","controversies","public image","impeachment","indictment","The Apprentice","campaign"];
  let mediaHits = 0;
  for (const w of mediaWords) {
    const rx = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`, "gi");
    mediaHits += (T.match(rx) || []).length;
  }
  const yearNorm = clamp01(yearCount / 1500);
  const mediaNorm = clamp01(mediaHits / 250);
  const P4 = clamp01(0.5 * yearNorm + 0.5 * mediaNorm);

  let P5 = 0;
  if (office === "representative" || office === "senator") {
    const tierA = ["Appropriations","Ways and Means","Energy and Commerce","Rules","Judiciary","Intelligence","Armed Services","Foreign Relations","Finance","HELP","Financial Services"];
    let pts = 0; for (const c of tierA) {
      const rx = new RegExp(`Committee[^\\n]{0,80}${c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}|${c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}[^\\n]{0,80}Committee`, "i");
      if (rx.test(T)) pts += 0.02;
    }
    P5 = clamp01(Math.min(pts, 0.1));
  }

  const P6 = /\bDemocratic Socialists of America\b/i.test(T) ? 1 : 0;
  return { P1, P2, P3, P4, P5, P6 };
}
function tierFromRoundedScore(score2d: number): "base"|"soft"|"hard" {
  if (score2d >= 0.7) return "hard";
  if (score2d >= 0.45) return "soft";
  return "base";
}
function demoteTierOnce(t: "base"|"soft"|"hard"): "base"|"soft"|"hard" {
  return t === "hard" ? "soft" : t === "soft" ? "base" : "base";
}
function computeLimitScore(text: string, office: ReturnType<typeof detectOfficeType>, incumbent: boolean) {
  const { P1, P2, P3, P4, P5, P6 } = computePillarsWikiOnly(text, office);
  let raw = 0.35 * P1 + 0.05 * P2 + 0.2 * P3 + 0.3 * P4 + 0.1 * P5 + 0.05 * P6;
  const floors: Record<string, number> = { president: 0.9, vice_president: 0.85, senator: 0.5, governor: 0.4 };
  const defaultCaps: Record<string, number> = { representative: 0.6, mayor: 0.4, cabinet: 0.4, candidate: 0.4 };
  let cap = defaultCaps[office ?? ""] ?? 1.0;
  if (office === "representative") {
    const T = normalizeWS(text);
    const { P3, P4, P6 } = computePillarsWikiOnly(T, office);
    if (P3 >= 0.9 && P4 >= 0.85 && (P6 === 1)) cap = 0.8;
  }
  let scored = Math.min(raw, cap);
  if (office && floors[office] != null) scored = Math.max(scored, floors[office]);
  const scoreRounded = round2(scored);
  let tier: "base"|"soft"|"hard" = tierFromRoundedScore(scoreRounded);
  if (!incumbent) tier = demoteTierOnce(tier);
  return { score: scoreRounded, tier };
}

/** ========================== FALLBACK SOURCE PICKER (when no Wikipedia) ========================== */
/** Tavily search wrapper */
async function tavilySearchFallback(query: string, includeDomains?: string[]): Promise<string[]> {
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

/** Fallback fetch with a friendly UA */
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
    },
  });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return await r.text();
}

/** Extra fallback: fetch readable text via Jina Reader proxy */
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

/** Generic web extractor for arbitrary URLs (profile_index parity) */
async function webExtractOneWithRetry(url: string): Promise<{ storedText: string; parseText: string; source: "tavily"|"html"|"jina" }> {
  // 1) Tavily extract (1–2 tries)
  try {
    const t1 = await extractWithRetry(url);
    if (t1 && t1.trim()) return { storedText: t1, parseText: t1, source: "tavily" };
  } catch {}
  try {
    const t2 = await extractWithRetry(url);
    if (t2 && t2.trim()) return { storedText: t2, parseText: t2, source: "tavily" };
  } catch {}

  // 2) Direct HTML with a neutral UA
  try {
    const html = await fetchHTMLWithUA(url);
    const text = stripHtml(html);
    if (text && text.trim()) return { storedText: html, parseText: text, source: "html" };
  } catch {}

  // 3) Jina Reader
  const jina = await fetchViaJinaReader(url);
  if (jina && jina.trim()) return { storedText: jina, parseText: jina, source: "jina" };

  throw new Error("All extraction fallbacks failed");
}

/** Find a fallback URL for a person when Wikipedia lookup fails (profile_index parity) */
async function findFallbackPersonUrl(name: string): Promise<string | null> {
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
  
  for (const q of queries) {
    try {
      const results = await tavilySearchFallback(q);
      const pick = (results || []).find((u) => judge(u));
      if (pick) return pick;
    } catch {
      continue;
    }
  }
  return null;
}

/** ========================== HTTP HANDLER ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method === "GET") {
      return new Response("ppl_search: POST { text_input, office_type }", { status: 200 });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok:false, error:"Use POST" }), { status: 405, headers: { "Content-Type":"application/json" }});
    }

    const ctype = req.headers.get("content-type") || "";
    const body = ctype.includes("application/json") ? await req.json().catch(() => ({})) : {};
    const text_input = String((body?.text_input ?? "")).trim();
    const office_type = String((body?.office_type ?? "")).trim(); // search hint only

    if (!text_input) {
      return new Response(JSON.stringify({ ok:false, error:"Body must include { text_input }", reason:"bad_request" }), {
        status: 400, headers: { "Content-Type":"application/json" }
      });
    }

    console.log(`[PPL_SEARCH] ===== START: Searching for "${text_input}" (office hint: ${office_type || 'none'}) =====`);

    // ---------- SEARCH ----------
    console.log(`[PPL_SEARCH] Step 1: Performing Tavily search`);
    const baseQuery = `${text_input} ${office_type || ""}`.trim();
    let urls: string[] = [];
    try { 
      urls = await tavilySearch(baseQuery, 10);
      console.log(`[PPL_SEARCH] Found ${urls.length} search results`);
    }
    catch (searchErr) { 
      console.warn(`[PPL_SEARCH] First search attempt failed, retrying...`, searchErr);
      await sleep(300); 
      urls = await tavilySearch(baseQuery, 10);
      console.log(`[PPL_SEARCH] Retry succeeded: Found ${urls.length} search results`);
    }
    urls = urls.filter((u, i, a) => typeof u === "string" && a.indexOf(u) === i);

    // Use the first THREE results for the decision corpus (unchanged)
    const pickedUrls = urls.slice(0, 3);
    console.log(`[PPL_SEARCH] Using top ${pickedUrls.length} URLs for decision corpus:`, pickedUrls);
    if (!pickedUrls.length) {
      console.error(`[PPL_SEARCH] FAIL: No search results found for "${text_input}"`);
      return new Response(JSON.stringify({ ok:false, reason:"invalid", error:"No search results" }), {
        status: 200, headers: { "Content-Type":"application/json" }
      });
    }

    // ---------- EXTRACT (up to three pages) ----------
    console.log(`[PPL_SEARCH] Step 2: Extracting content from ${pickedUrls.length} URLs`);
    let corpus: { url: string; text: string }[] = [];
    {
      const extractions = await Promise.allSettled(
        pickedUrls.map(async (u) => {
          const t = await extractWithRetry(u);
          return { url: u, text: hardTrim(t) };
        })
      );
      corpus = extractions
        .filter((p): p is PromiseFulfilledResult<{url:string;text:string}> => p.status === "fulfilled")
        .map(p => p.value)
        .filter(e => (e.text || "").trim().length > 0);

      console.log(`[PPL_SEARCH] Successfully extracted ${corpus.length}/${pickedUrls.length} pages`);
      if (!corpus.length) {
        console.error(`[PPL_SEARCH] FAIL: All extractions failed for "${text_input}"`);
        return new Response(JSON.stringify({ ok:false, reason:"invalid", error:"Extraction failed", source_urls: pickedUrls }), {
          status: 200, headers: { "Content-Type":"application/json" }
        });
      }
    }

    // ---------- DECIDE (Mistral) ----------
    console.log(`[PPL_SEARCH] Step 3: Using Mistral to validate US politician status`);
    let mx: MxDecision | null = null;
    try { 
      mx = await mistralDecide(corpus, text_input, office_type || "politician");
      console.log(`[PPL_SEARCH] Mistral decision: us_based=${mx?.us_based}, is_candidate=${mx?.is_candidate}, office=${mx?.office_type}, status=${mx?.status}`);
    }
    catch (decideErr) {
      console.warn(`[PPL_SEARCH] First Mistral attempt failed, retrying...`, decideErr);
      await sleep(300);
      try { 
        mx = await mistralDecide(corpus, text_input, office_type || "politician");
        console.log(`[PPL_SEARCH] Retry succeeded: us_based=${mx?.us_based}, is_candidate=${mx?.is_candidate}, office=${mx?.office_type}`);
      }
      catch (decideErr2) {
        console.error(`[PPL_SEARCH] FAIL: Both Mistral attempts failed for "${text_input}"`, decideErr2);
        return new Response(JSON.stringify({ ok:false, reason:"invalid", source_urls: pickedUrls }), {
          status: 200, headers: { "Content-Type":"application/json" }
        });
      }
    }

    // ---------- VALIDATION RULES ----------
    console.log(`[PPL_SEARCH] Step 4: Validating politician eligibility`);
    const hasOffice = !!mx?.office_type && (mx?.status === "current" || mx?.status === "former");
    const isCandidate = (mx?.is_candidate === true) && !hasOffice; // candidate only if NO office detected
    const usOk = mx?.us_based === true;
    const isPolitician = hasOffice || isCandidate;

    console.log(`[PPL_SEARCH] Validation results: us_based=${usOk}, hasOffice=${hasOffice}, isCandidate=${isCandidate}, isPolitician=${isPolitician}`);
    
    if (!usOk || !isPolitician) {
      console.error(`[PPL_SEARCH] FAIL: "${text_input}" does not meet politician criteria (us_based=${usOk}, isPolitician=${isPolitician})`);
      return new Response(JSON.stringify({ ok:false, reason:"invalid", source_urls: pickedUrls }), {
        status: 200, headers: { "Content-Type":"application/json" }
      });
    }
    console.log(`[PPL_SEARCH] Validation passed: "${text_input}" is a valid US politician`);

    // ---------- DEDUP ----------
    console.log(`[PPL_SEARCH] Step 5: Checking for duplicate entries`);
    const variantsRaw = Array.isArray(mx?.name_variants) && mx!.name_variants.length
      ? mx!.name_variants
      : [text_input, mx?.canonical_name ?? text_input];

    const variants = Array.from(new Set(variantsRaw.concat([text_input]).map(v => v || "").filter(Boolean)));
    console.log(`[PPL_SEARCH] Checking ${variants.length} name variants:`, variants);
    
    if (await isDuplicate(variants)) {
      console.error(`[PPL_SEARCH] FAIL: Duplicate detected for "${text_input}" (variants: ${variants.join(', ')})`);
      return new Response(JSON.stringify({ ok:false, reason:"duplicate", source_urls: pickedUrls }), {
        status: 200, headers: { "Content-Type":"application/json" }
      });
    }
    console.log(`[PPL_SEARCH] No duplicate found, proceeding with creation`);

    // ---------- CANONICAL NAME + SUB_NAME ----------
    console.log(`[PPL_SEARCH] Step 6: Determining canonical name and sub_name`);
    const canonical = chooseCanonicalName(mx || null, text_input, corpus);
    console.log(`[PPL_SEARCH] Canonical name selected: "${canonical}"`);
    
    const sub_name = subNameFromDecision({ ...(mx as MxDecision), is_candidate: isCandidate }, office_type || null);
    console.log(`[PPL_SEARCH] Sub name generated: "${sub_name}"`);
    
    if (!sub_name) {
      console.error(`[PPL_SEARCH] FAIL: Could not generate sub_name for "${canonical}"`);
      return new Response(JSON.stringify({ ok:false, reason:"invalid", source_urls: pickedUrls }), {
        status: 200, headers: { "Content-Type":"application/json" }
      });
    }

    // ---------- ALLOCATE ID & INSERT ----------
    console.log(`[PPL_SEARCH] Step 7: Allocating ID and inserting into ppl_index`);
    const newId = await findLowestUnusedId();
    console.log(`[PPL_SEARCH] Allocated ID: ${newId}`);
    
    const { data: ins, error: insErr } = await supabase
      .from("ppl_index")
      .insert({ id: newId, name: canonical, sub_name })
      .select("id")
      .single();
    if (insErr || !ins) {
      console.error(`[PPL_SEARCH] FAIL: Insert failed for "${canonical}" (ID ${newId}):`, insErr);
      return new Response(JSON.stringify({ ok:false, error: insErr?.message || "insert_failed", source_urls: pickedUrls }), {
        status: 500, headers: { "Content-Type":"application/json" }
      });
    }
    console.log(`[PPL_SEARCH] Successfully inserted "${canonical}" with ID ${ins.id}`);

    // ---------- WIKIPEDIA FETCH (official API with fallback - profile_index parity) ----------
    console.log(`[PPL_SEARCH] ===== WIKIPEDIA FETCH: Processing "${canonical}" (ID ${ins.id}) =====`);
    let wikiText: string | null = null;
    let wikiUrl: string | null = null;
    let wikiSaved = false;
    let fallbackUsed = false;
    
    try {
      console.log(`[PPL_SEARCH] Attempting Wikipedia fetch for "${canonical}"`);
      const wiki = await fetchWikipediaText(canonical, sub_name);
      if (wiki?.text && wiki.text.trim().length > 200) {
        wikiText = wiki.text;
        wikiUrl = wiki.url;
        console.log(`[PPL_SEARCH] SUCCESS: Fetched ${wikiText.length} characters from ${wikiUrl}`);
        await putParts(`ppl/${ins.id}/profile.wikipedia`, wikiText);
        wikiSaved = true;
        console.log(`[PPL_SEARCH] Wikipedia content stored successfully`);
      }
    } catch (wikiErr) {
      // Wikipedia not found → fallback (profile_index parity)
      console.warn(`[PPL_SEARCH] Wikipedia not found for "${canonical}" (id=${ins.id}), error:`, wikiErr);
      console.log(`[PPL_SEARCH] Marking politician ID ${ins.id} as weak (no Wikipedia)`);
      await supabase.from("ppl_index").update({ weak: true }).eq("id", ins.id);

      console.log(`[PPL_SEARCH] Attempting fallback search for "${canonical}"`);
      try {
        const fallbackUrl = await findFallbackPersonUrl(canonical);
        if (fallbackUrl) {
          console.log(`[PPL_SEARCH] SUCCESS: Found fallback url=${fallbackUrl}`);
          const ext = await webExtractOneWithRetry(fallbackUrl);
          wikiText = ext.parseText;
          wikiUrl = fallbackUrl;
          fallbackUsed = true;
          console.log(`[PPL_SEARCH] Extracted ${wikiText.length} characters from fallback (source: ${ext.source})`);
          
          // Store fallback content
          await putParts(`ppl/${ins.id}/profile.wikipedia`, wikiText);
          wikiSaved = true;
          console.log(`[PPL_SEARCH] Fallback content stored successfully`);
        } else {
          console.warn(`[PPL_SEARCH] FAIL: No fallback found for "${canonical}" (id=${ins.id}); using minimal stub`);
          wikiText = `No Wikipedia page found for ${canonical}. No suitable fallback page discovered.`;
          wikiUrl = null;
          await putParts(`ppl/${ins.id}/profile.wikipedia`, wikiText);
          wikiSaved = true;
        }
      } catch (fallbackErr) {
        console.error(`[PPL_SEARCH] Fallback extraction failed:`, fallbackErr);
        // Store minimal stub
        wikiText = `No Wikipedia page found for ${canonical}. Fallback extraction failed.`;
        wikiUrl = null;
        try {
          await putParts(`ppl/${ins.id}/profile.wikipedia`, wikiText);
          wikiSaved = true;
        } catch (storageErr) {
          console.error(`[PPL_SEARCH] Failed to store stub content:`, storageErr);
        }
      }
    }

    // ---------- FILL ppl_index COLUMNS (profile_index parity) ----------
    console.log(`[PPL_SEARCH] ===== FIELD EXTRACTION: Processing "${canonical}" =====`);
    let patch: any = {};
    // slug always safe
    patch.slug = toSlug(canonical);

    if (wikiText && wikiText.length > 200) {
      console.log(`[PPL_SEARCH] Extracting person fields using Mistral`);
      const ext = await extractPersonFields(canonical, wikiText, sub_name);
      console.log(`[PPL_SEARCH] Extraction complete - confidence: ${ext.confidence}, office: ${ext.office_type}, party: ${ext.party_type}`);

      let office_type_extracted = ext.office_type;
      const gov_level  = mapGovLevel(ext.office_type);
      const party_type = ext.party_type;
      const state_code = ext.state_code;

      // ================== POLITICIAN RULES (profile_index parity) ==================
      const subNameStr = (sub_name ?? "").toString();
      const hasSecretary = /\bsecretary\b/i.test(subNameStr);
      const isFormer = /\bformer\b/i.test(subNameStr);
      const knownRoleRx = /\b(president|vice\s*president|senator|representative|governor|mayor|cabinet|candidate)\b/i;
      const subNameIsUnknownRole = subNameStr.length > 0 && !knownRoleRx.test(subNameStr);

      let office_type_special: typeof office_type_extracted = office_type_extracted ?? null;
      if (hasSecretary) {
        office_type_special = "cabinet";
        console.log(`[PPL_SEARCH] Detected 'secretary' in sub_name, setting office_type to 'cabinet'`);
      } else if (subNameIsUnknownRole) {
        office_type_special = "official" as any;
        console.log(`[PPL_SEARCH] Detected unknown role in sub_name, setting office_type to 'official'`);
      }

      patch.office_type = office_type_special ?? null;
      patch.gov_level = gov_level ?? null;
      patch.party_type = party_type ?? null;
      patch.state_code = state_code ?? null;

      // Compute limit score + tier
      console.log(`[PPL_SEARCH] Computing limit score and tier`);
      const incumbentFinal = (ext.incumbent ?? isIncumbent(wikiText));
      const officeDetected = (office_type_special ?? "candidate") as any;
      const { score, tier: tierComputed } = computeLimitScore(wikiText, officeDetected, incumbentFinal ?? false);
      
      // Force tier base if "former" appears in sub_name (profile_index parity)
      let tier = tierComputed;
      if (isFormer && tier !== "base") {
        console.log(`[PPL_SEARCH] Detected 'former' in sub_name, forcing tier to 'base'`);
        tier = "base";
      }
      
      patch.limit_score = score;
      patch.tier = tier;
      console.log(`[PPL_SEARCH] Computed - limit_score: ${score}, tier: ${tier}, incumbent: ${incumbentFinal}`);
    } else {
      // No usable Wikipedia/fallback text: fill what we can from decision
      console.log(`[PPL_SEARCH] No usable text content, using Mistral decision data only`);
      const ot = mx?.office_type ?? null;
      patch.office_type = ot;
      patch.gov_level = mapGovLevel(ot);
      patch.state_code = (mx?.state_code && /^[A-Z]{2}$/.test(mx.state_code)) ? mx.state_code : null;
      console.log(`[PPL_SEARCH] Set office_type: ${ot}, gov_level: ${patch.gov_level}, state_code: ${patch.state_code}`);
      // party_type/limit_score/tier left null
    }

    if (Object.keys(patch).length) {
      console.log(`[PPL_SEARCH] Updating ${Object.keys(patch).length} fields:`, patch);
      const { error: upErr } = await supabase.from("ppl_index").update(patch).eq("id", ins.id);
      if (upErr) {
        console.error(`[PPL_SEARCH] FAIL: Error updating ppl_index:`, upErr);
        throw upErr;
      }
      console.log(`[PPL_SEARCH] ppl_index update successful`);
    } else {
      console.log(`[PPL_SEARCH] No fields need updating in ppl_index`);
    }

    console.log(`[PPL_SEARCH] ===== COMPLETE: Politician "${canonical}" (ID ${ins.id}) created successfully =====`);

    return new Response(JSON.stringify({
      ok: true,
      created: true,
      ppl_id: ins.id,
      name: canonical,
      sub_name,
      source_urls: pickedUrls,
      wiki_url: wikiUrl,
      prefer_common_name: PREFER_COMMON_NAME,
      wiki_saved: wikiSaved,
      fallback_used: fallbackUsed,
      updated_fields: Object.keys(patch),
      limit_score: patch.limit_score ?? null,
      tier: patch.tier ?? null
    }), { headers: { "Content-Type":"application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || String(e) }), {
      status: 500, headers: { "Content-Type":"application/json" }
    });
  }
});
