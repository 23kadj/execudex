/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const WEB_BUCKET     = Deno.env.get("WEB_BUCKET") || "web";
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const PART_LEN = 110_000; // chunk stored pages into ~110k-char parts
const FETCH_TIMEOUT_MS = Number(Deno.env.get("WIKI_TIMEOUT_MS") ?? 15000);

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== HELPERS ========================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Expand user input like `hr7340` into multiple bill-code variants to improve recall */
function expandBillQueryTerms(raw: string): string[] {
  const r = raw.trim();
  const m = r.match(/^\s*([hs]|h\.?r\.?|s\.?|h\.j\.?res\.?|s\.j\.?res\.?|h\.con\.?res\.?|s\.con\.?res\.?|h\.res\.?|s\.res\.?)\s*\.?\s*(\d{1,5})\s*$/i);
  if (!m) return [r];
  const prefixRaw = m[1].toUpperCase().replace(/\s+/g, "");
  const num = m[2];
  const map: Record<string,string> = {
    "H":"H.R.", "HR":"H.R.", "H.R.":"H.R.",
    "S":"S.", "S.":"S.",
    "H.JRES":"H.J.Res.", "H.J.RES.":"H.J.Res.",
    "S.JRES":"S.J.Res.", "S.J.RES.":"S.J.Res.",
    "H.CONRES":"H.Con.Res.", "H.CON.RES.":"H.Con.Res.",
    "S.CONRES":"S.Con.Res.", "S.CON.RES.":"S.Con.Res.",
    "H.RES":"H.Res.", "S.RES":"S.Res."
  };
  const normPrefix = map[prefixRaw.replace(/\./g,"")] || prefixRaw;
  return [
    `${normPrefix} ${num}`,
    `${normPrefix}${num}`,
    `${normPrefix.replace(/\./g,"")} ${num}`,
    `${normPrefix.replace(/\./g,"")}${num}`,
    r
  ];
}

/** Tavily search (optionally restricted to includeDomains) */
async function tavilySearch(query: string, includeDomains?: string[]) {
  const body: any = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: 15,
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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

/** Tavily extract with one retry; else HTML+UA; else Jina Reader. Parse/stored text. */
async function tavilyExtractOneWithRetryOrHtml(
  url: string
): Promise<{ storedText: string; parseText: string; source: "tavily" | "html" | "jina" }> {
  // 1) Tavily #1
  try {
    const t1 = await tavilyExtractOne(url);
    if (t1 && t1.trim()) return { storedText: t1, parseText: t1, source: "tavily" };
  } catch {}
  // 2) Tavily #2
  try {
    const t2 = await tavilyExtractOne(url);
    if (t2 && t2.trim()) return { storedText: t2, parseText: t2, source: "tavily" };
  } catch {}
  // 3) HTML with UA
  try {
    const html = await fetchHTMLWithUA(url);
    const text = stripHtml(html);
    if (text && text.trim()) return { storedText: html, parseText: text, source: "html" };
  } catch {}
  // 4) Jina Reader
  const jinaText = await fetchViaJinaReader(url);
  if (jinaText && jinaText.trim()) {
    return { storedText: jinaText, parseText: jinaText, source: "jina" };
  }
  throw new Error("All extraction fallbacks failed");
}

/** Normalize any congress.gov bill URL to the ROOT path ending at the bill number. */
function normalizeToBillRoot(u: string): string | null {
  try {
    const url = new URL(u);
    if (!/^(?:www\.)?congress\.gov$/i.test(url.hostname)) return null;
    const parts = url.pathname.replace(/\/+$/, "").split("/");
    // ["", "bill", "{118th-congress}", "{type}", "{number}", ...]
    if (parts.length < 5) return null;
    if (parts[1] !== "bill") return null;
    if (!/^\d+(?:st|nd|rd|th)-congress$/i.test(parts[2] || "")) return null;
    if (!/^\d+$/.test(parts[4] || "")) return null;
    const rootPath = ["", "bill", parts[2], parts[3], parts[4]].join("/");
    return `https://www.congress.gov${rootPath}`;
  } catch {
    return null;
  }
}

/** Pick the first congress.gov bill candidate and normalize to the bill root */
function pickCongressUrlRoots(urls: string[]): string[] {
  const candidates = urls
    .filter((u) => /^https?:\/\/(?:www\.)?congress\.gov\/bill\//i.test(u))
    .map((u) => normalizeToBillRoot(u))
    .filter((u): u is string => !!u);
  // de-duplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
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

/** Parse bill code from page text, e.g., "H.R. 1", "S. 12", "H.J.Res. 5", ... */
function parseBillCodeFromText(txt: string): string | null {
  const rx = /\b(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.|H\.Res\.|S\.Res\.)\s*\.?\s*(\d{1,5})\b/gi;
  const m = rx.exec(txt);
  if (!m) return null;
  const prefix = m[1].replace(/\s+/g, "");
  const num = m[2];
  return `${prefix} ${num}`.replace(/\s+/g, " ").trim();
}

/** Fallback bill code from URL path type mapping */
function billCodeFromUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    const parts = url.pathname.replace(/\/+$/, "").split("/");
    // ["", "bill", "{cong}", "{type}", "{num}"]
    const type = (parts[3] || "").toLowerCase();
    const num = parts[4];
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
    if (/^\d+$/.test(num || "") && map[type]) return `${map[type]} ${num}`;
    return null;
  } catch { return null; }
}

/** Remove spaces in code for DB name ("H.R. 1" -> "H.R.1") */
function canonicalNoSpaces(code: string): string {
  return code.replace(/\s+/g, "");
}

/** Upload page content to storage (chunk at PART_LEN). Return stored paths. */
async function putParts(basePath: string, content: string): Promise<string[]> {
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
  await Promise.all(
    parts.map((part, idx) =>
      supabase.storage
        .from(WEB_BUCKET)
        .upload(paths[idx], new Blob([part], { type: "text/plain; charset=utf-8" }), {
          upsert: true,
          contentType: "text/plain; charset=utf-8",
        })
    )
  );
  return paths;
}

/** Find the lowest unused positive integer id in legi_index (paged scan) */
async function findLowestUnusedLegiId(): Promise<number> {
  const PAGE = 10000;
  let expected = 1;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("legi_index")
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

/** Try to find the first root URL whose congress ordinal matches the input. Iterate one-by-one and stop on first match. */
function* iterRootsByOrder(urls: string[]): Generator<string> {
  const roots = pickCongressUrlRoots(urls);
  for (const r of roots) yield r;
}

/** ========================== ENRICHMENT HELPERS (from your other script) ========================== */

/** Minimal JSON chat helper used by mistralExtractLegi */
async function mistralJSON(system: string, user: string, maxTokens = 600) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      temperature: 0.0,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  if (!r.ok) throw new Error(`Mistral error ${r.status}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

/** Download and concatenate previously stored synopsis parts */
async function downloadAll(paths: string[]): Promise<string> {
  const chunks: string[] = [];
  for (const p of paths) {
    const { data, error } = await supabase.storage.from(WEB_BUCKET).download(p);
    if (error || !data) continue;
    const txt = await data.text();
    chunks.push(txt);
  }
  return chunks.join("\n");
}

/** Pick the best congress.gov bill candidate and normalize to the ROOT bill URL */
function pickCongressUrlRoot(urls: string[]): string | null {
  const candidates = urls
    .filter((u) => /^https?:\/\/www\.congress\.gov\/bill\//i.test(u))
    .map((u) => normalizeToBillRoot(u))
    .filter((u): u is string => !!u);
  return candidates[0] || null;
}

/** Bill level: for congress.gov it is nationwide */
function inferBillLevelFromUrl(u?: string): "nationwide" | "statewide" | "local" {
  try {
    const host = u ? new URL(u).host.toLowerCase() : "";
    if (/congress\.gov|house\.gov|senate\.gov|govinfo\.gov/.test(host)) return "nationwide";
  } catch {}
  return "nationwide";
}

/** Date helpers for enrichment */
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

/** Map congress.gov path segment to canonical bill code prefix (compact) */
function billIdFromCongressUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (!/congress\.gov$/i.test(url.hostname)) return null;
    // Expect: /bill/{118th-congress}/{type}/{number}[/*optional]
    const parts = url.pathname.replace(/\/+$/, "").split("/");
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

/** --------- Storage-first helpers for legislation synopses --------- */
async function listStoredLegiSynopsisPaths(id: number): Promise<string[]> {
  const prefix = `legi/${id}`;
  const { data, error } = await supabase.storage
    .from(WEB_BUCKET)
    .list(prefix, { limit: 500, sortBy: { column: "name", order: "asc" } });
  if (error || !data) return [];

  const candidates = data
    .filter(f => /synopsis/i.test(f.name) && /\.txt$/i.test(f.name))
    .map(f => `${prefix}/${f.name}`);

  if (!candidates.length) return [];

  const groups = new Map<string, string[]>();
  for (const p of candidates) {
    const base = p.replace(/\.\d+\.txt$/i, ".txt");
    const arr = groups.get(base) || [];
    arr.push(p);
    groups.set(base, arr);
  }

  const bases = [...groups.keys()].sort((a, b) => {
    const ax = a.match(/synopsis\.(\d+)\./i)?.[1];
    const bx = b.match(/synopsis\.(\d+)\./i)?.[1];
    return (Number(ax) || 0) - (Number(bx) || 0);
  });
  const chosenBase = bases.pop();
  if (!chosenBase) return [];

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

/** Main handler for legislation enrichment (your original logic) */
async function handleLegiById(id: number) {
  // 1) fetch legi row
  const { data: row, error } = await supabase.from("legi_index").select("*").eq("id", id).single();
  if (error || !row) throw new Error(`legi_index id ${id} not found`);
  const needAny = !row.sub_name || !row.bill_lvl || !row.bill_status || !row.bill_id || !row.congress;

  let storedPaths: string[] = [];
  let extractedStored = "";
  let parseBase = "";
  let urlUsed = "";

  if (needAny) {
    // --------- STORAGE-FIRST for existing synopsis under legi/{id}/ ---------
    const existing = await listStoredLegiSynopsisPaths(id);
    if (existing.length) {
      storedPaths = existing;
      extractedStored = await downloadAll(existing);
      parseBase = extractedStored;
      urlUsed = (await latestLegiWebContentLink(id)) || "";
    }

    // If nothing usable found in storage, continue with network path (unchanged)
    if (!parseBase || parseBase.length < 200) {
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
      storedPaths = await putParts(base, extractedStored);

      // Update web_content.path to point at the first part (link already set on insert)
      await supabase.from("web_content").update({ path: storedPaths[0] }).eq("id", webId);

      // mark indexed=true after storing scanned page(s)
      await supabase.from("legi_index").update({ indexed: true }).eq("id", id);
    }
  }

  if (!needAny) return { id, updated: {}, stored_paths: [] };

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

  // --- congress ordinal (e.g., "119th") derived from URL ---
  const congressText = congressFromUrl(urlUsed); // must look like "119th"

  // ---------- persist ----------
  const patch: Record<string, any> = {};
  // Only set fields that are currently empty on the row
  if (!row.bill_lvl && bill_lvl) patch.bill_lvl = bill_lvl;
  if (!row.sub_name && sub_name) patch.sub_name = sub_name;
  if (!row.bill_status && bill_status) patch.bill_status = bill_status;
  if (!row.bill_id && bill_id) patch.bill_id = bill_id;
  if (!row.congress && congressText) patch.congress = congressText;

  if (Object.keys(patch).length) {
    const { error: upErr } = await supabase.from("legi_index").update(patch).eq("id", id);
    if (upErr) throw upErr;
  }

  return { id, updated: patch, url: urlUsed, stored_paths: storedPaths };
}

/** ========================== HTTP HANDLER (combined) ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method === "GET") {
      return new Response("bill_search: POST { title: string, congress_session: number }", { status: 200 });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok:false, error:"Use POST" }), {
        status: 405, headers: { "Content-Type":"application/json" }
      });
    }

    const ctype = req.headers.get("content-type") || "";
    const body = ctype.includes("application/json") ? await req.json().catch(() => ({})) : {};
    const rawTitle = String((body?.title ?? "")).trim();
    const sessionNum = Number(body?.congress_session);

    if (!rawTitle || !Number.isInteger(sessionNum) || sessionNum <= 0) {
      return new Response(JSON.stringify({ ok:false, reason:"bad_request" }), {
        status: 400, headers: { "Content-Type":"application/json" }
      });
    }

    const ordinal = toOrdinal(sessionNum); // e.g., "110th"
    const terms = expandBillQueryTerms(rawTitle);
    const orTerms = terms.map(t => `"${t}"`).join(" OR ");

    // ---------- SEARCH congress.gov (pass A: with ordinal) ----------
    let urlsA: string[] = [];
    try {
      urlsA = await tavilySearch(`${orTerms} ${ordinal} site:congress.gov`, ["congress.gov"]);
    } catch {
      await sleep(300);
      try { urlsA = await tavilySearch(`${orTerms} ${ordinal} site:congress.gov`, ["congress.gov"]); } catch { urlsA = []; }
    }

    // ---------- SEARCH congress.gov (pass B: without ordinal) ----------
    let urlsB: string[] = [];
    try {
      urlsB = await tavilySearch(`${orTerms} site:congress.gov`, ["congress.gov"]);
    } catch {
      await sleep(300);
      try { urlsB = await tavilySearch(`${orTerms} site:congress.gov`, ["congress.gov"]); } catch { urlsB = []; }
    }

    const allUrls = [...urlsA, ...urlsB];

    if (!allUrls.length) {
      return new Response(JSON.stringify({ ok:false, reason:"not_found" }), { headers: { "Content-Type":"application/json" }});
    }

    // ---------- ONE-BY-ONE: pick first candidate whose URL congress matches ----------
    let root: string | null = null;
    for (const candidate of iterRootsByOrder(allUrls)) {
      const urlCong = congressFromUrl(candidate);
      if (urlCong && urlCong.toLowerCase() === ordinal.toLowerCase()) {
        root = candidate;
        break; // stop at the first matching root
      }
    }

    // ---------- SESSION MISMATCH (informative error) ----------
    if (!root) {
      // Try the first valid congress.gov root we saw (any congress) to detect a mismatch.
      let firstAnyRoot: string | null = null;
      for (const candidate of iterRootsByOrder(allUrls)) { firstAnyRoot = candidate; break; }

      if (firstAnyRoot) {
        const urlCong = congressFromUrl(firstAnyRoot); // e.g., "117th"
        try {
          const ext = await tavilyExtractOneWithRetryOrHtml(firstAnyRoot);
          const parsedCode = parseBillCodeFromText(ext.parseText) || billCodeFromUrl(firstAnyRoot);
          const wantedPrimary = terms[0] || rawTitle;
          const wantedCore = canonicalNoSpaces(wantedPrimary).toUpperCase().replace(/\./g,"");
          const foundCore = parsedCode ? canonicalNoSpaces(parsedCode).toUpperCase().replace(/\./g,"") : "";

          if (foundCore && wantedCore && foundCore === wantedCore) {
            return new Response(JSON.stringify({
              ok: false,
              reason: "session_mismatch",
              expected_congress: ordinal,
              found_congress: urlCong,
              found_url: firstAnyRoot
            }), { headers: { "Content-Type":"application/json" }});
          }
        } catch { /* ignore and fall through */ }
      }
      return new Response(JSON.stringify({ ok:false, reason:"not_found" }), { headers: { "Content-Type":"application/json" }});
    }

    // ---------- EXTRACT PAGE (retry + fallbacks) ----------
    let storedText = "", parseText = "";
    try {
      const ext = await tavilyExtractOneWithRetryOrHtml(root);
      storedText = ext.storedText;
      parseText = ext.parseText;
    } catch {
      return new Response(JSON.stringify({ ok:false, reason:"not_found" }), { headers: { "Content-Type":"application/json" }});
    }

    // ---------- PARSE BILL CODE ----------
    let billCode = parseBillCodeFromText(parseText);
    if (!billCode) billCode = billCodeFromUrl(root);
    if (!billCode) {
      return new Response(JSON.stringify({ ok:false, reason:"not_found" }), { headers: { "Content-Type":"application/json" }});
    }
    const nameNoSpaces = canonicalNoSpaces(billCode); // "H.R.1"

    // ---------- DERIVE BILL_ID FOR DUPLICATE CHECK ----------
    const bill_id = billIdFromCongressUrl(root) || null;

    // ---------- DUPLICATE CHECK (check both name and bill_id) ----------
    {
      // Check for duplicate by name and congress
      const { data: dupByName } = await supabase
        .from("legi_index")
        .select("id")
        .eq("name", nameNoSpaces)
        .eq("congress", ordinal)
        .limit(1);
      
      // Check for duplicate by bill_id and congress (if bill_id is available)
      let dupByBillId = null;
      if (bill_id) {
        const { data: billIdDup } = await supabase
          .from("legi_index")
          .select("id")
          .eq("bill_id", bill_id)
          .eq("congress", ordinal)
          .limit(1);
        dupByBillId = billIdDup;
      }
      
      // If either check finds a duplicate, return duplicate error
      if ((Array.isArray(dupByName) && dupByName.length > 0) || 
          (Array.isArray(dupByBillId) && dupByBillId.length > 0)) {
        return new Response(JSON.stringify({ ok:false, reason:"duplicate" }), { headers: { "Content-Type":"application/json" }});
      }
    }

    // ---------- ALLOCATE LOWEST UNUSED ID ----------
    const legiId = await findLowestUnusedLegiId();

    // ---------- INSERT legi_index (id, name, congress only) ----------
    {
      const { error: insErr } = await supabase
        .from("legi_index")
        .insert({ id: legiId, name: nameNoSpaces, congress: ordinal });
      if (insErr) {
        return new Response(JSON.stringify({ ok:false, reason:"insert_failed" }), {
          status: 500, headers: { "Content-Type":"application/json" }
        });
      }
    }

    // ---------- CREATE web_content ROW (pending path) ----------
    const { data: wcIns, error: wcErr } = await supabase
      .from("web_content")
      .insert({ path: "pending", owner_id: legiId, is_ppl: false, link: root, used: false })
      .select("id")
      .single();

    if (wcErr || !wcIns) {
      return new Response(JSON.stringify({ ok:false, reason:"insert_failed" }), {
        status: 500, headers: { "Content-Type":"application/json" }
      });
    }
    const webId = wcIns.id as number;

    // ---------- STORE PAGE (chunk if >110k) ----------
    const base = `legi/${legiId}/synopsis.${webId}.congress`;
    const storedPaths = await putParts(base, storedText);

    // ---------- UPDATE web_content.path ----------
    await supabase.from("web_content").update({ path: storedPaths[0] }).eq("id", webId);

    // ===================== ENRICH RIGHT AWAY (your other script) =====================
    const enrichment = await handleLegiById(legiId);

    // ---------- DONE ----------
    return new Response(JSON.stringify({
      ok: true,
      created: true,
      legi_id: legiId,
      name: nameNoSpaces,
      congress: ordinal,
      enrichment
    }), { headers: { "Content-Type":"application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, reason:"not_found", error: e?.message || String(e) }), {
      status: 200, headers: { "Content-Type":"application/json" }
    });
  }
});
