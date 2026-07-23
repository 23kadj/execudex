/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const WEB_BUCKET     = Deno.env.get("WEB_BUCKET") || "web";
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const PART_LEN = 150_000; // chunk stored pages into ~150k-char parts
const FETCH_TIMEOUT_MS = Number(Deno.env.get("WIKI_TIMEOUT_MS") ?? 15000);
const BULK_ENRICH_CONCURRENCY = 5; // cap concurrent per-bill enrichment chains (each is ~4 Tavily + up to 7 Mistral calls)

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== HELPERS ========================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run async work over items with bounded concurrency (prevents unbounded fan-out) */
async function runLimited<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function launch(): Promise<void> {
    const my = idx++;
    if (my >= items.length) return;
    out[my] = await worker(items[my]);
    return launch();
  }
  await Promise.all([...Array(Math.min(limit, items.length))].map(() => launch()));
  return out;
}

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
  const prefix = m[1].toUpperCase().replace(/\s+/g, "");
  const num = m[2];
  return `${prefix} ${num}`.replace(/\s+/g, " ").trim();
}

/** Heuristic filter for bad/blocked-page titles */
function isSuspiciousBillTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const t = title.trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  if (/^\d{4}\)?$/.test(t)) return true; // "2026" or "2026)"
  // Not anchored to the start: Tavily's extraction sometimes synthesizes a "Title: <page
  // title>" line from a blocked page's <title> tag when there's no real content to
  // extract (e.g. a Cloudflare challenge page), which would otherwise slip past an
  // anchored check and land in the DB as a bill's display title verbatim.
  if (/just a moment\.*/i.test(lower)) return true;
  if (/checking your browser/i.test(lower)) return true;
  if (/please wait/i.test(lower)) return true;
  if (/access denied/i.test(lower)) return true;
  if (/attention required/i.test(lower)) return true;
  // A real title has multiple real words. Reject fragments that are mostly
  // digits/punctuation with at most one incidental run of letters — this catches
  // bare bill codes ("H.R.5") and Statutes at Large citations ("21, 86Stat1329"),
  // both page furniture that was getting picked up as the display title for
  // unrelated bills.
  const wordTokens = t.match(/[a-zA-Z]{3,}/g) || [];
  if (wordTokens.length < 2) return true;
  return false;
}

/** Longest display title we will store. Anything longer falls back to the bare bill
 *  code, which is why most rows render as "H.R.1234" instead of a real title. Raising
 *  this is a UI decision -- these strings render in fixed-size cards -- so it lives here
 *  as one knob rather than being repeated at each call site. */
const TITLE_MAX_CHARS = 30;

/** The single place that turns an extracted/refined title into a storable display name.
 *
 *  The insert path and the enrichment path each did this on their own and disagreed:
 *  enrichment stripped a trailing year, insert did not, so the same bill could be stored
 *  as "Healthy Technology Act of 2025" or as "Overtime Pay Tax Relief Act of" depending
 *  on which path ran. Nothing strips years now -- removing "2025" from "... Act of 2025"
 *  leaves a dangling "of", which is precisely how those truncated titles were produced.
 *  A title still ending in a connective is treated as a truncation artifact and rejected
 *  so the bill falls back to its code rather than displaying a fragment. */
function normalizeDisplayTitle(
  raw: string | null | undefined,
  billCode: string | null | undefined
): string | null {
  let t = String(raw || "").replace(/\s+/g, " ").trim();
  if (!t) return null;

  if (billCode) {
    const codeEsc = billCode.replace(/\s+/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`^\\s*${codeEsc}[\\s:\\-\u2013\u2014]*`, "i"), "").trim();
  }

  if (/\b(of|the|and|for|to|a|an|in|on|with|by)$/i.test(t)) return null;
  if (isSuspiciousBillTitle(t)) return null;
  if (t.length > TITLE_MAX_CHARS) return null;
  return t;
}

/** Extract a human-readable bill title from page text (word title, not bill id) */
function extractBillWordTitleFromText(txt: string, billCode: string | null): string | null {
  if (!txt) return null;
  const code = (billCode || "").trim();

  // Try to find a line like "H.R.1 - Title..." or "H.R. 1 — Title..."
  if (code) {
    const codeNoSpaces = code.replace(/\s+/g, "");
    const codeEsc = codeNoSpaces.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rxLine = new RegExp(
      `^.*\\b${codeEsc}\\b[^:\\n]*[:\\-\\u2014]\\s*(.+)$`,
      "mi"
    );
    const m = txt.match(rxLine);
    if (m && m[1]) {
      const candidate = m[1]
        .split("|")[0]           // strip trailing site name if present
        .replace(/\s+/g, " ")
        .trim();
      if (candidate) return candidate;
    }
  }

  // Fallback: first non-empty line that looks like a title (no "Actions -", "Navigation", etc.)
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^actions\s*-/i.test(line)) continue;
    if (/^navigation$/i.test(line)) continue;
    if (/^(house|senate)\s+calendar/i.test(line)) continue;
    if (isSuspiciousBillTitle(line)) continue;
    if (line.length >= 5 && /[a-zA-Z]/.test(line)) {
      let out = line.replace(/\s+/g, " ").trim();
      // If fallback line includes bill code prefix, strip it so we return ONLY the word title.
      if (code) {
        const codeNoSpaces = code.replace(/\s+/g, "");
        const codeEsc = codeNoSpaces.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`^\\s*${codeEsc}\\s*[:\\-\\u2014]\\s*`, "i"), "");
        out = out.replace(new RegExp(`^\\s*${codeEsc}\\s+`, "i"), "");
        out = out.trim();
      }
      return out;
    }
  }

  return null;
}

/** Clean and de-dupe a raw word title using Mistral to drop bill ids and stray years */
async function refineTitleWithMistral(rawTitle: string, billCode?: string | null): Promise<string | null> {
  try {
    const sys = `
You are a precise title cleaner for congress.gov bill titles. Remove bill codes (e.g., "H.R.4016", "S.1582") and trailing congress/session years that are just metadata (e.g., ", 2026"). Keep the real, human-readable title text. If the year is an essential part of the official title (e.g., "Act of 2001"), keep it. Never return only a year. Return concise plain text with no bill id prefix.

Return ONLY JSON:
{ "clean_title": "<clean title or null if unsure>" }
`.trim();

    const usr = `
Raw title: "${rawTitle}"
Bill code (if any): "${billCode || ""}"
`.trim();

    const res = await mistralJSON(sys, usr, 0, "clean_title");
    const out = (res?.clean_title ?? null) as string | null;
    if (typeof out === "string") {
      const cleaned = out.replace(/\s+/g, " ").trim();
      if (cleaned && !/^\d{4}$/.test(cleaned)) return cleaned;
    }
    return null;
  } catch {
    return null;
  }
}

/** Format a date like "03/01/2025" as "March 1st, 2025". Falls back to the original string on parse errors. */
function formatDateWithOrdinalFromMDY(s: string): string {
  try {
    const parts = s.split(/[/-]/);
    if (parts.length < 3) return s;
    const monthNum = parseInt(parts[0], 10);
    const dayNum = parseInt(parts[1], 10);
    const yearNum = parseInt(parts[2], 10);
    if (!monthNum || !dayNum || !yearNum) return s;

    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    const monthName = months[monthNum - 1];
    if (!monthName) return s;

    const j = dayNum % 10, k = dayNum % 100;
    let suffix = "th";
    if (j === 1 && k !== 11) suffix = "st";
    else if (j === 2 && k !== 12) suffix = "nd";
    else if (j === 3 && k !== 13) suffix = "rd";

    return `${monthName} ${dayNum}${suffix}, ${yearNum}`;
  } catch {
    return s;
  }
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

/** Canonicalize a bill id like "H.R. 1" or "HR1" to a comparable form "HR1" */
function canonicalBillId(code: string | null | undefined): string {
  return String(code || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
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
async function mistralJSON(system: string, user: string, maxTokens = 600, debugLabel?: string) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      temperature: 0.0,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  if (!r.ok) {
    const errorText = await r.text().catch(() => "");
    console.error(`[mistralJSON]${debugLabel ? ` [${debugLabel}]` : ""} Mistral API error ${r.status}:`, errorText);
    throw new Error(`Mistral error ${r.status}`);
  }
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  
  // Log raw response if it's empty or looks problematic
  if (!content || content.trim() === "{}" || content.trim() === "") {
    console.warn(`[mistralJSON]${debugLabel ? ` [${debugLabel}]` : ""} Mistral returned empty or invalid content. Full response:`, JSON.stringify(j));
  }
  
  try { 
    const parsed = JSON.parse(content);
    // Log if result is empty object
    if (parsed && Object.keys(parsed).length === 0) {
      console.warn(`[mistralJSON]${debugLabel ? ` [${debugLabel}]` : ""} Parsed JSON is empty object. Raw content was:`, content.substring(0, 200));
    }
    return parsed; 
  } catch (parseErr) {
    console.error(`[mistralJSON]${debugLabel ? ` [${debugLabel}]` : ""} Failed to parse JSON. Content was:`, content.substring(0, 500));
    return {};
  }
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

/** Extract congress number from congress string (e.g., "119th" from "119th Congress" or "119th-congress") */
function congressNumberFromString(congress: string | null | undefined): string | null {
  if (!congress) return null;
  const match = congress.match(/(\d+)(?:th|st|nd|rd)/i);
  return match ? match[1] : null;
}

/** Construct congress.gov URL from bill_id and congress string */
function constructCongressGovUrl(billId: string, congress: string | null | undefined): string | null {
  if (!billId) return null;
  
  // Parse bill_id (e.g., "S.1582", "H.R.1", "H.J.Res.5")
  const billMatch = billId.match(/^(H|S)\.(?:R\.|J\.Res\.|Con\.Res\.|Res\.)?(\d+)$/i);
  if (!billMatch) return null;
  
  const chamber = billMatch[1].toUpperCase();
  const number = billMatch[2];
  
  // Determine bill type from bill_id format
  let billType: string;
  if (billId.match(/^H\.R\./i)) {
    billType = "house-bill";
  } else if (billId.match(/^S\./i) && !billId.match(/\./)) {
    billType = "senate-bill";
  } else if (billId.match(/^H\.J\.Res\./i)) {
    billType = "house-joint-resolution";
  } else if (billId.match(/^S\.J\.Res\./i)) {
    billType = "senate-joint-resolution";
  } else if (billId.match(/^H\.Con\.Res\./i)) {
    billType = "house-concurrent-resolution";
  } else if (billId.match(/^S\.Con\.Res\./i)) {
    billType = "senate-concurrent-resolution";
  } else if (billId.match(/^H\.Res\./i)) {
    billType = "house-resolution";
  } else if (billId.match(/^S\.Res\./i)) {
    billType = "senate-resolution";
  } else {
    return null;
  }
  
  // Extract congress number (e.g., "119" from "119th Congress")
  const congNum = congressNumberFromString(congress);
  if (!congNum) return null;
  
  return `https://www.congress.gov/bill/${congNum}th-congress/${billType}/${number}`;
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

/** ========================== METADATA ENRICHMENT ========================== */

/** Wrapper to enrich bill metadata for existing bills (automatically fetches URL from database) */
async function enrichBillMetadataById(legiId: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Load existing legi_index row so we know the expected bill_id / congress
    const { data: legiRow, error: legiErr } = await supabase
      .from("legi_index")
      .select("id, name, bill_id, congress")
      .eq("id", legiId)
      .single();

    if (legiErr || !legiRow) {
      return {
        success: false,
        error: `legi_index id ${legiId} not found`,
      };
    }

    const expectedBillId = legiRow.bill_id ? String(legiRow.bill_id) : null;
    const expectedCanon = canonicalBillId(expectedBillId);
    const expectedCong = typeof legiRow.congress === "string" ? legiRow.congress.trim() : undefined;

    // Get the congress.gov URL from web_content table
    const storedUrl = await latestLegiWebContentLink(legiId);
    
    if (!storedUrl) {
      return { 
        success: false, 
        error: `No URL found in web_content table for legi_id ${legiId}` 
      };
    }

    // Normalize to root URL (remove any sub-paths like /text, /summary, etc.)
    let rootUrl = normalizeToBillRoot(storedUrl);
    let urlToUse: string | null = rootUrl;

    // If we have an expected bill_id, verify that the stored URL's bill_id matches.
    if (urlToUse && expectedCanon) {
      const pageBillId = billIdFromCongressUrl(urlToUse);
      const pageCanon = canonicalBillId(pageBillId);

      const idsMatch = pageCanon && pageCanon === expectedCanon;

      if (!idsMatch) {
        console.warn(
          `[enrichBillMetadataById] Stored URL bill_id (${pageBillId}) does not match expected bill_id (${expectedBillId}) for legi_id ${legiId}. Constructing correct URL...`
        );

        // First, try to construct the URL directly from bill_id + congress (much faster than searching)
        const constructedUrl = constructCongressGovUrl(expectedBillId!, expectedCong);
        if (constructedUrl) {
          // Verify the constructed URL has the correct bill_id
          const constructedBillId = billIdFromCongressUrl(constructedUrl);
          const constructedCanon = canonicalBillId(constructedBillId);
          if (constructedCanon && constructedCanon === expectedCanon) {
            urlToUse = constructedUrl;
            console.log(
              `[enrichBillMetadataById] Constructed correct congress.gov URL for legi_id ${legiId}: ${urlToUse} (bill_id matches ${expectedBillId})`
            );
          } else {
            console.warn(
              `[enrichBillMetadataById] Constructed URL ${constructedUrl} does not match expected bill_id. Falling back to search...`
            );
          }
        }

        // If construction failed or didn't match, fall back to Tavily search (slower but more reliable)
        if (!urlToUse || canonicalBillId(billIdFromCongressUrl(urlToUse)) !== expectedCanon) {
          console.log(
            `[enrichBillMetadataById] Re-searching congress.gov for legi_id ${legiId} with bill_id ${expectedBillId}...`
          );

          const terms = expandBillQueryTerms(expectedBillId!);
          const orTerms = terms.map((t) => `"${t}"`).join(" OR ");

          let urlsA: string[] = [];
          let urlsB: string[] = [];
          try {
            if (expectedCong) {
              urlsA = await tavilySearch(`${orTerms} ${expectedCong} site:congress.gov`, ["congress.gov"]);
            }
          } catch {}
          try {
            urlsB = await tavilySearch(`${orTerms} site:congress.gov`, ["congress.gov"]);
          } catch {}

          const allUrls = [...urlsA, ...urlsB];
          let corrected: string | null = null;
          for (const candidate of iterRootsByOrder(allUrls)) {
            const cBillId = billIdFromCongressUrl(candidate);
            const cCanon = canonicalBillId(cBillId);
            const cCong = congressFromUrl(candidate);
            if (
              cCanon &&
              cCanon === expectedCanon &&
              (!expectedCong || (cCong && cCong.toLowerCase() === expectedCong.toLowerCase()))
            ) {
              corrected = candidate;
              break;
            }
          }

          if (corrected) {
            urlToUse = corrected;
            console.log(
              `[enrichBillMetadataById] Resolved correct congress.gov URL via search for legi_id ${legiId}: ${urlToUse} (bill_id matches ${expectedBillId})`
            );
          } else {
            console.error(
              `[enrichBillMetadataById] Unable to find a congress.gov page whose bill_id matches expected ${expectedBillId} for legi_id ${legiId}. Skipping enrichment to avoid using wrong bill.`
            );
            return {
              success: false,
              error: `bill_id mismatch and unable to resolve correct congress.gov page for legi_id ${legiId}`,
            };
          }
        }
      }
    }

    if (!urlToUse) {
      return {
        success: false,
        error: `Could not determine a valid congress.gov URL for legi_id ${legiId}`,
      };
    }

    // Call the enrichment function using the verified (or corrected) URL
    await enrichBillMetadata(legiId, urlToUse);

    // Also backfill sub_name/bill_lvl/bill_status/bill_id/congress if still missing.
    // enrichBillMetadata only fills subject/latest_action/cosponsors/committees/actions —
    // it never touches these fields, so a bill whose handleLegiById call failed once at
    // creation time (network hiccup, Mistral error) would otherwise stay permanently
    // missing sub_name and never show up on the Most Recent page.
    try {
      await handleLegiById(legiId);
    } catch (e) {
      console.warn(`[enrichBillMetadataById] handleLegiById backfill failed for legi_id ${legiId}:`, e);
    }

    return { success: true };
  } catch (e: any) {
    return { 
      success: false, 
      error: e?.message || String(e) 
    };
  }
}

/** Extract bill_id from page text (e.g., "H.R.1", "S.1582") using regex */
function extractBillIdFromText(text: string): string | null {
  if (!text) return null;
  // Look for patterns like "H.R.1", "S.1582", "H.J.Res.5", etc. in the text
  const patterns = [
    /(?:^|\s)(H\.R\.\d+)/i,
    /(?:^|\s)(S\.\d+)/i,
    /(?:^|\s)(H\.J\.Res\.\d+)/i,
    /(?:^|\s)(S\.J\.Res\.\d+)/i,
    /(?:^|\s)(H\.Con\.Res\.\d+)/i,
    /(?:^|\s)(S\.Con\.Res\.\d+)/i,
    /(?:^|\s)(H\.Res\.\d+)/i,
    /(?:^|\s)(S\.Res\.\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/** Verify that a page URL's bill_id matches the expected bill_id (fast URL-based check) */
function verifyPageUrlBillId(
  pageUrl: string,
  expectedBillId: string | null,
  expectedCong: string | null | undefined
): { url: string; verified: boolean } {
  if (!expectedBillId) {
    // No expected bill_id to verify against, trust the URL
    return { url: pageUrl, verified: true };
  }

  const expectedCanon = canonicalBillId(expectedBillId);
  const pageBillId = billIdFromCongressUrl(pageUrl);
  const pageCanon = canonicalBillId(pageBillId);

  if (pageCanon && pageCanon === expectedCanon) {
    // Bill IDs match, URL is correct
    return { url: pageUrl, verified: true };
  }

  // Bill IDs don't match - construct the correct URL for this sub-page
  console.warn(
    `[verifyPageUrlBillId] URL bill_id (${pageBillId}) does not match expected (${expectedBillId}). Constructing correct URL...`
  );

  const correctedUrl = constructCongressGovUrl(expectedBillId, expectedCong);
  if (correctedUrl) {
    // Determine sub-path from original URL (e.g., "/cosponsors", "/committees", "/all-actions")
    const urlObj = new URL(pageUrl);
    const pathParts = urlObj.pathname.split("/").filter(p => p);
    const subPathIndex = pathParts.findIndex(p => ["cosponsors", "committees", "all-actions"].includes(p.toLowerCase()));
    
    if (subPathIndex >= 0) {
      const subPath = pathParts.slice(subPathIndex).join("/");
      const correctedSubUrl = `${correctedUrl}/${subPath}`;
      console.log(
        `[verifyPageUrlBillId] Corrected URL: ${pageUrl} -> ${correctedSubUrl}`
      );
      return { url: correctedSubUrl, verified: false };
    } else {
      // No sub-path, just use the root URL
      return { url: correctedUrl, verified: false };
    }
  }

  // Could not construct corrected URL, return original (will likely fail later)
  console.error(
    `[verifyPageUrlBillId] Could not construct corrected URL for bill_id ${expectedBillId}`
  );
  return { url: pageUrl, verified: false };
}

/** Extract and enrich bill metadata (subject, latest_action, cosponsors, committees, actions) */
async function enrichBillMetadata(legiId: number, baseUrl: string): Promise<void> {
  try {
    // Get expected bill_id, congress, name, bill_status, and current field values for optimization
    const { data: legiRow } = await supabase
      .from("legi_index")
      .select("id, bill_id, congress, name, bill_status, subject, latest_action, cosponsors, committees, actions")
      .eq("id", legiId)
      .single();
    
    const expectedBillId = legiRow?.bill_id ? String(legiRow.bill_id) : null;
    const expectedCong = typeof legiRow?.congress === "string" ? legiRow.congress.trim() : undefined;
    const billStatus = legiRow?.bill_status as string | null | undefined;
    
    // If bill is passed or failed, skip fields that are already populated
    const skipPopulatedFields = billStatus === "passed" || billStatus === "failed";
    
    // Check which fields are already populated
    const hasSubject = legiRow?.subject && String(legiRow.subject).trim() !== "";
    const hasLatestAction = legiRow?.latest_action && String(legiRow.latest_action).trim() !== "";
    const hasCosponsors = legiRow?.cosponsors && String(legiRow.cosponsors).trim() !== "";
    const hasCommittees = legiRow?.committees && String(legiRow.committees).trim() !== "";
    const hasActions = legiRow?.actions && String(legiRow.actions).trim() !== "";
    
    if (skipPopulatedFields) {
      console.log(
        `[enrichBillMetadata] Bill status is "${billStatus}" for legi_id ${legiId}. Skipping populated fields. ` +
        `Fields to process: subject=${!hasSubject}, latest_action=${!hasLatestAction}, ` +
        `cosponsors=${!hasCosponsors}, committees=${!hasCommittees}, actions=${!hasActions}`
      );
    }

    // Verify baseUrl's bill_id matches expected (fast URL check - no API calls)
    // Note: enrichBillMetadataById already verified this, but we double-check here for safety
    const mainUrlVerification = verifyPageUrlBillId(baseUrl, expectedBillId, expectedCong);
    const verifiedMainUrl = mainUrlVerification.url;
    
    if (!mainUrlVerification.verified && verifiedMainUrl !== baseUrl) {
      console.warn(
        `[enrichBillMetadata] Main URL bill_id mismatch detected for legi_id ${legiId}. Using corrected URL: ${verifiedMainUrl}`
      );
    }

    // Always fetch the latest main bill page via Tavily (do not reuse stored synopsis text)
    let mainPageText = "";
    try {
      console.log(`[enrichBillMetadata] Fetching fresh main page for legi_id ${legiId}: ${verifiedMainUrl}`);
      const ext = await tavilyExtractOneWithRetryOrHtml(verifiedMainUrl);
      mainPageText = ext.parseText || "";
      console.log(`[enrichBillMetadata] Fresh main page text length for legi_id ${legiId}: ${mainPageText.length}`);
    } catch (e) {
      console.error(`[enrichBillMetadata] Failed to fetch fresh main page for legi_id ${legiId}:`, e);
      mainPageText = "";
    }

    // Prepare update payload
    const updates: Record<string, any> = {};
    updates.data_update = new Date().toISOString();

    // --------- NAME NORMALIZATION BASED ON WORD TITLE LENGTH ---------
    // The extraction tasks below (name, subject, latest_action, cosponsors,
    // committees, actions) each write a distinct field on `updates` and don't
    // depend on each other's output — run them concurrently instead of
    // sequentially so the ~5-6 Tavily+Mistral round trips overlap.
    const doNameNormalization = async () => {
    try {
      const existingNameRaw = (legiRow?.name ?? "").toString().trim();
      const billCodeFromUrl = billIdFromCongressUrl(verifiedMainUrl);
      const billCompact = (billCodeFromUrl || "").replace(/\s+/g, "").toUpperCase();
      let allowNameUpdate = false;

      if (!existingNameRaw) {
        // No name set yet – safe to set one.
        allowNameUpdate = true;
      } else {
        const existingCompact = existingNameRaw.replace(/\s+/g, "").toUpperCase();
        const billIdLikeRx = /^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)\d+$/i;
        const matchesBillIdPattern = billIdLikeRx.test(existingCompact);
        const matchesBillCode = billCompact && existingCompact === billCompact;
        const looksLikeBareYear =
          /^\s*\d{4}\s*\)?\s*$/.test(existingNameRaw); // e.g., "2026" or "2026)"

        // Only treat as auto-updatable if it looks like a bill id or obviously-bad year-only title.
        if (matchesBillIdPattern || matchesBillCode || looksLikeBareYear) {
          allowNameUpdate = true;
        } else {
          console.log(`[enrichBillMetadata] Existing name for legi_id ${legiId} appears to be a custom word title ("${existingNameRaw}"); will NOT overwrite.`);
        }
      }

      if (allowNameUpdate) {
        const wordTitle = extractBillWordTitleFromText(mainPageText, billCodeFromUrl);
        if (wordTitle) {
          const mistralTitle = await refineTitleWithMistral(wordTitle, billCodeFromUrl);
          const cleanedTitle = normalizeDisplayTitle(mistralTitle || wordTitle, billCodeFromUrl);
          const chosenName = cleanedTitle ?? (billCodeFromUrl || null);

          if (chosenName) {
            updates.name = chosenName;
            console.log(
              `[enrichBillMetadata] Normalized name for legi_id ${legiId}: ${chosenName} (title length ${cleanedTitle?.length ?? 0}, previous name "${existingNameRaw || "<none>"}")`
            );
          }
        }
      }
    } catch (e) {
      console.error(`[enrichBillMetadata] Failed to normalize name for legi_id ${legiId}:`, e);
    }
    };

    // Extract subject/policy area from main page using Mistral
    const doSubject = async () => {
    if (mainPageText && (!skipPopulatedFields || !hasSubject)) {
      try {
        const subjectSys = `You are a precise data extractor. Extract data from congressional bill pages. Return ONLY valid JSON with the exact structure requested.`;
        const subjectUsr = `
Extract the "Subject — Policy Area:" section from the following text from a congress.gov bill page.

Look for text that says "Subject — Policy Area:" or similar, followed by subject names.

CRITICAL: You MUST return a JSON object with this exact structure:
{
  "subjects": ["Subject Name 1", "Subject Name 2", ...]
}

Return ALL subjects/policy areas if multiple are listed. If no "Subject — Policy Area:" section exists, return: {"subjects": []}

TEXT FROM PAGE:
"""${mainPageText}"""
`;
        const subjectResult = await mistralJSON(subjectSys, subjectUsr, 0, "subject");
        console.log(`[enrichBillMetadata] Subject extraction result for legi_id ${legiId}:`, JSON.stringify(subjectResult));
        const subjects = subjectResult?.subjects;
        if (Array.isArray(subjects) && subjects.length > 0) {
          updates.subject = subjects.join(", ");
          console.log(`[enrichBillMetadata] Extracted subject for legi_id ${legiId}: ${updates.subject}`);
        } else {
          console.warn(`[enrichBillMetadata] No subjects found for legi_id ${legiId}. Result:`, subjectResult);
        }
      } catch (e) {
        console.error(`[enrichBillMetadata] Failed to extract subject for legi_id ${legiId}:`, e);
      }
    } else if (skipPopulatedFields && hasSubject) {
      console.log(`[enrichBillMetadata] Skipping subject extraction for legi_id ${legiId} (already populated)`);
    }
    };

    // Extract and reformat latest action using Mistral
    const doLatestAction = async () => {
    if (mainPageText && (!skipPopulatedFields || !hasLatestAction)) {
      try {
        const actionSys = `You are a precise editor. Extract and reformat legislative action text into clear, readable English. Return ONLY valid JSON with the exact structure requested.`;
        const actionUsr = `
Find the "Latest Action:" section in the following text from a congress.gov bill page.

Extract the action text and reformat it into clear, readable English following this format:
"On [Month] [Day], [Year], the [Chamber] [action description]."

Example transformation:
Input: "Senate - 02/10/2025 Received in the Senate and Read twice and referred to the Committee on the Judiciary."
Output: "On February 10, 2025, the Senate chamber received the legislation, read it twice, and referred it to the Committee on the Judiciary."

CRITICAL: You MUST return a JSON object with this exact structure:
{
  "latest_action": "On [Month] [Day], [Year], the [Chamber] [action description]."
}

If no latest action found, return: {"latest_action": null}

TEXT FROM PAGE:
"""${mainPageText}"""
`;
        const actionResult = await mistralJSON(actionSys, actionUsr, 0, "latest_action");
        console.log(
          `[enrichBillMetadata] Latest action extraction result for legi_id ${legiId}:`,
          JSON.stringify(actionResult)
        );
        if (
          actionResult?.latest_action &&
          actionResult.latest_action !== "null" &&
          actionResult.latest_action !== null
        ) {
          updates.latest_action = actionResult.latest_action;
          console.log(
            `[enrichBillMetadata] Extracted latest_action for legi_id ${legiId}: ${updates.latest_action}`
          );
        } else {
          console.warn(
            `[enrichBillMetadata] No latest_action found for legi_id ${legiId}. Result:`,
            actionResult
          );
        }
      } catch (e) {
        console.error(
          `[enrichBillMetadata] Failed to extract/reformat latest action for legi_id ${legiId}:`,
          e
        );
      }
    } else if (skipPopulatedFields && hasLatestAction) {
      console.log(
        `[enrichBillMetadata] Skipping latest_action extraction for legi_id ${legiId} (already populated)`
      );
    }
    };

    // Extract cosponsors from /cosponsors page
    const doCosponsors = async () => {
    if (!skipPopulatedFields || !hasCosponsors) {
      try {
      const cosponsorsUrlRaw = `${verifiedMainUrl}/cosponsors`;
      // Verify URL bill_id matches expected (fast check - no API calls)
      const cosponsorsVerification = verifyPageUrlBillId(cosponsorsUrlRaw, expectedBillId, expectedCong);
      const cosponsorsUrl = cosponsorsVerification.url;
      
      console.log(`[enrichBillMetadata] Fetching cosponsors page for legi_id ${legiId}: ${cosponsorsUrl}`);
      const cosponsorsExt = await tavilyExtractOneWithRetryOrHtml(cosponsorsUrl);
      const cosponsorsText = cosponsorsExt.parseText;
      console.log(`[enrichBillMetadata] Cosponsors page text length for legi_id ${legiId}: ${cosponsorsText?.length || 0}`);
      
      if (cosponsorsText && cosponsorsText.length > 100) {
        const cosponsorsSys = `You are a precise data extractor. Extract data from congressional bill cosponsor tables. Return ONLY valid JSON with the exact structure requested.`;
        const cosponsorsUsr = `
Extract all cosponsors from the following text from a congress.gov bill "Cosponsors" page.

The text contains a table with cosponsor names and dates. For each cosponsor:
- Remove titles like "Rep.", "Sen.", "Del.", "Resident Commissioner"
- Format name as "FirstName LastName" (first name first, last name second)
- Include the date cosponsored in MM/DD/YYYY format

CRITICAL: You MUST return a JSON object with this exact structure:
{
  "cosponsors": [
    {"name": "FirstName LastName", "date": "MM/DD/YYYY"},
    {"name": "FirstName LastName", "date": "MM/DD/YYYY"}
  ]
}

If no cosponsors found, return: {"cosponsors": []}

TEXT FROM PAGE:
"""${cosponsorsText.slice(0, 150000)}"""
`;
        const cosponsorsResult = await mistralJSON(cosponsorsSys, cosponsorsUsr, 0, "cosponsors");
        console.log(`[enrichBillMetadata] Cosponsors extraction result for legi_id ${legiId}:`, JSON.stringify(cosponsorsResult));
        const cosponsors = cosponsorsResult?.cosponsors;
        if (Array.isArray(cosponsors) && cosponsors.length > 0) {
          const formatted = cosponsors
            .filter((c: any) => c?.name && c?.date)
            .map((c: any) => `${c.name} ${c.date}`)
            .join(", ");
          if (formatted) {
            updates.cosponsors = formatted;
            console.log(`[enrichBillMetadata] Extracted cosponsors for legi_id ${legiId}: ${updates.cosponsors.substring(0, 100)}...`);
          } else {
            console.warn(`[enrichBillMetadata] Cosponsors array was empty after filtering for legi_id ${legiId}`);
          }
        } else {
          console.warn(`[enrichBillMetadata] No cosponsors found for legi_id ${legiId}. Result:`, cosponsorsResult);
        }
      } else {
        console.warn(`[enrichBillMetadata] Cosponsors page text too short for legi_id ${legiId}: ${cosponsorsText?.length || 0} chars`);
      }
      } catch (e) {
        console.error(`[enrichBillMetadata] Failed to extract cosponsors for legi_id ${legiId}:`, e);
      }
    } else if (skipPopulatedFields && hasCosponsors) {
      console.log(`[enrichBillMetadata] Skipping cosponsors extraction for legi_id ${legiId} (already populated)`);
    }
    };

    // Extract committees from /committees page and format as readable sentences
    const doCommittees = async () => {
    if (!skipPopulatedFields || !hasCommittees) {
      try {
      const committeesUrlRaw = `${verifiedMainUrl}/committees`;
      // Verify URL bill_id matches expected (fast check - no API calls)
      const committeesVerification = verifyPageUrlBillId(committeesUrlRaw, expectedBillId, expectedCong);
      const committeesUrl = committeesVerification.url;
      
      console.log(`[enrichBillMetadata] Fetching committees page for legi_id ${legiId}: ${committeesUrl}`);
      const committeesExt = await tavilyExtractOneWithRetryOrHtml(committeesUrl);
      const committeesText = committeesExt.parseText;
      console.log(`[enrichBillMetadata] Committees page text length for legi_id ${legiId}: ${committeesText?.length || 0}`);
      
      if (committeesText && committeesText.length > 100) {
        const committeesSys = `You are a precise data extractor. Extract data from congressional bill committee tables. Return ONLY valid JSON with the exact structure requested.`;
        const committeesUsr = `
Extract all committee entries from the following text from a congress.gov bill "Committees" page.

The text contains a table with committee information. For each entry, extract:
- name: The full committee name
- date: The date in MM/DD/YYYY format
- activity: The activity or action taken by the committee

CRITICAL: You MUST return a JSON object with this exact structure:
{
  "committees": [
    {"name": "Committee Name", "date": "MM/DD/YYYY", "activity": "Activity description"},
    {"name": "Committee Name", "date": "MM/DD/YYYY", "activity": "Activity description"}
  ]
}

If no committees found, return: {"committees": []}

TEXT FROM PAGE:
"""${committeesText.slice(0, 150000)}"""
`;
        const committeesResult = await mistralJSON(committeesSys, committeesUsr, 0, "committees");
        console.log(`[enrichBillMetadata] Committees extraction result for legi_id ${legiId}:`, JSON.stringify(committeesResult));
        const committees = committeesResult?.committees;
        if (Array.isArray(committees) && committees.length > 0) {
          // Use Mistral again to turn committee entries into clean sentences
          try {
            const sentSys = `You are a precise editor. Turn committee records into clear, single sentences. Return ONLY valid JSON with the exact structure requested.`;
            const sentUsr = `
You are given committee records for a congressional bill in JSON form.

Each record has:
- "name": committee name
- "date": date in MM/DD/YYYY format
- "activity": what the committee did

For EACH record, write ONE grammatically correct English sentence that describes what happened, using this style:
- Convert the date to "Month D, YYYY" (e.g., 05/20/2025 -> May 20, 2025).
- Mention the committee by name.
- Describe the activity as a natural phrase.

Examples:
Input record: {"name":"House Budget","date":"05/20/2025","activity":"Reported Original Measure"}
Sentence: "On May 20, 2025, the House Budget Committee reported the original measure."

CRITICAL: You MUST return a JSON object with this exact structure:
{
  "sentences": [
    "Sentence about first committee.",
    "Sentence about second committee."
  ]
}

Use one sentence per committee record. Do not join them; just return the array of sentences.

COMMITTEE RECORDS (JSON):
"""${JSON.stringify(committees)}"""
`;
            const sentResult = await mistralJSON(sentSys, sentUsr, 0, "committees_sentences");
            console.log(`[enrichBillMetadata] Committees sentence formatting result for legi_id ${legiId}:`, JSON.stringify(sentResult));
            const sentences = Array.isArray(sentResult?.sentences)
              ? sentResult.sentences.filter((s: any) => typeof s === "string" && s.trim())
              : [];
            if (sentences.length > 0) {
              // One sentence per committee, separated by " | "
              const joined = sentences.join(" | ");
              updates.committees = joined;
              console.log(`[enrichBillMetadata] Formatted committees sentences for legi_id ${legiId}: ${joined.substring(0, 120)}...`);
            } else {
              console.warn(
                `[enrichBillMetadata] No committee sentences returned; falling back to raw format for legi_id ${legiId}`
              );
              const fallback = committees
                .filter((c: any) => c?.name && c?.date && c?.activity)
                .map((c: any) => `${c.name} ${c.date} ${c.activity}`)
                .join(" | ");
              if (fallback) updates.committees = fallback;
            }
          } catch (e) {
            console.error(`[enrichBillMetadata] Failed to format committees into sentences for legi_id ${legiId}:`, e);
            const fallback = committees
              .filter((c: any) => c?.name && c?.date && c?.activity)
              .map((c: any) => `${c.name} ${c.date} ${c.activity}`)
              .join(" | ");
            if (fallback) updates.committees = fallback;
          }
        } else {
          console.warn(`[enrichBillMetadata] No committees found for legi_id ${legiId}. Result:`, committeesResult);
        }
      } else {
        console.warn(`[enrichBillMetadata] Committees page text too short for legi_id ${legiId}: ${committeesText?.length || 0} chars`);
      }
      } catch (e) {
        console.error(`[enrichBillMetadata] Failed to extract committees for legi_id ${legiId}:`, e);
      }
    } else if (skipPopulatedFields && hasCommittees) {
      console.log(`[enrichBillMetadata] Skipping committees extraction for legi_id ${legiId} (already populated)`);
    }
    };

    // Extract actions from /all-actions page
    const doActions = async () => {
    if (!skipPopulatedFields || !hasActions) {
      try {
      const actionsUrlRaw = `${verifiedMainUrl}/all-actions`;
      // Verify URL bill_id matches expected (fast check - no API calls)
      const actionsVerification = verifyPageUrlBillId(actionsUrlRaw, expectedBillId, expectedCong);
      const actionsUrl = actionsVerification.url;
      
      console.log(`[enrichBillMetadata] Fetching actions page for legi_id ${legiId}: ${actionsUrl}`);
      const actionsExt = await tavilyExtractOneWithRetryOrHtml(actionsUrl);
      const actionsText = actionsExt.parseText;
      console.log(`[enrichBillMetadata] Actions page text length for legi_id ${legiId}: ${actionsText?.length || 0}`);
      
      if (actionsText && actionsText.length > 100) {
        // Look for a sample of the actions text to help with debugging
        const sampleText = actionsText.slice(0, 150000);
        console.log(`[enrichBillMetadata] Actions page sample text for legi_id ${legiId}:`, sampleText.substring(0, 500));
        
        // Try to find where the actual table starts
        const tableStart = actionsText.toLowerCase().search(/(?:date|chamber|action|all actions)/);
        const tableSection = tableStart > 0 
          ? actionsText.slice(Math.max(0, tableStart - 500), Math.min(actionsText.length, tableStart + 50000))
          : actionsText.slice(0, 50000); // Fallback: use first 50k chars if table start not found
        
        console.log(`[enrichBillMetadata] Actions table section start position for legi_id ${legiId}: ${tableStart > 0 ? tableStart : 'not found'}`);
        console.log(`[enrichBillMetadata] Actions table section length for legi_id ${legiId}: ${tableSection.length} chars`);
        
        // Use the focused tableSection instead of full text to reduce processing time
        const textToProcess = tableSection.length > 0 ? tableSection : actionsText.slice(0, 50000);
        
        const actionsSys = `You are a precise data extractor. Extract data from congressional bill action tables. Return ONLY valid JSON with the exact structure requested.`;
        const actionsUsr = `
Extract ALL legislative actions from the following text from a congress.gov bill "All Actions" page. 

The page contains a table or list of legislative actions. Each action has:
- A date (in MM/DD/YYYY or similar format)
- A chamber (House, Senate, or similar)
- An action description (what happened with the bill)

Look for patterns like:
- "Date" followed by dates
- "Chamber" followed by House/Senate
- Action descriptions that describe what happened (e.g., "Introduced", "Referred to Committee", "Passed House", "Signed by President", etc.)

For each action you find, extract:
- date: The date in MM/DD/YYYY format (convert if needed)
- chamber: The chamber name (House, Senate, etc.)
- action: The complete action description

CRITICAL: You MUST return a JSON object with this exact structure:
{
  "actions": [
    {"date": "MM/DD/YYYY", "chamber": "Chamber Name", "action": "Action description"},
    {"date": "MM/DD/YYYY", "chamber": "Chamber Name", "action": "Action description"}
  ]
}

Extract ALL actions found in the text. If no actions are found, return: {"actions": []}

TEXT FROM PAGE:
"""${textToProcess}"""
`;
        const actionsResult = await mistralJSON(actionsSys, actionsUsr, 0, "actions");
        console.log(`[enrichBillMetadata] Actions extraction result for legi_id ${legiId}:`, JSON.stringify(actionsResult));
        
        // Check if Mistral returned an empty object (common failure case)
        if (!actionsResult || Object.keys(actionsResult).length === 0) {
          console.error(`[enrichBillMetadata] Mistral returned empty object for actions. Text length sent: ${textToProcess.length} chars`);
        }
        
        const actions = actionsResult?.actions;
        if (Array.isArray(actions) && actions.length > 0) {
          // Use Mistral again to turn actions into clean sentences (without dates)
          try {
            const actSentSys = `You are a precise editor. Turn legislative actions into clear, single sentences. Return ONLY JSON.`;
            const actSentUsr = `
You are given legislative action records for a congressional bill in JSON form.

Each record has:
- "date": date in MM/DD/YYYY format
- "chamber": chamber name (House, Senate, etc.)
- "action": a description of what happened

For EACH record, write ONE grammatically correct English sentence that describes what happened, using this style:
- Start with the actor or context (for example, "The House", "The Senate", "The President").
- Do NOT include the date in the sentence; we will add the date separately before the sentence.

Example:
Input record: {"date":"03/01/2025","chamber":"House","action":"introduced the bill."}
Sentence: "The House introduced the bill."

CRITICAL: You MUST return a JSON object with this exact structure:
{
  "sentences": [
    "Sentence about first action (no date in the text).",
    "Sentence about second action (no date in the text)."
  ]
}

Use one sentence per action record. Do not mention the date in the sentence; we will prefix the date separately.

ACTION RECORDS (JSON):
"""${JSON.stringify(actions)}"""
`;
            const actSentResult = await mistralJSON(actSentSys, actSentUsr, 0, "actions_sentences");
            console.log(`[enrichBillMetadata] Actions sentence formatting result for legi_id ${legiId}:`, JSON.stringify(actSentResult));
            const sentences = Array.isArray(actSentResult?.sentences)
              ? actSentResult.sentences.filter((s: any) => typeof s === "string" && s.trim())
              : [];
            if (sentences.length > 0) {
              // Prefix each sentence with formatted date and join with " | "
              const joined = actions
                .filter((a: any, idx: number) => a?.date && a?.chamber && a?.action && sentences[idx])
                .map((a: any, idx: number) => {
                  const prettyDate = formatDateWithOrdinalFromMDY(String(a.date));
                  const desc = String(sentences[idx]).trim();
                  return `${prettyDate}: ${desc}`;
                })
                .join(" | ");
              if (joined) {
                updates.actions = joined;
                console.log(`[enrichBillMetadata] Formatted actions sentences for legi_id ${legiId}: ${joined.substring(0, 120)}...`);
              } else {
                console.warn(`[enrichBillMetadata] No valid formatted action sentences produced; falling back to raw format for legi_id ${legiId}`);
                const fallback = actions
                  .filter((a: any) => a?.date && a?.chamber && a?.action)
                  .map((a: any) => `${formatDateWithOrdinalFromMDY(String(a.date))}: ${a.action}`)
                  .join(" | ");
                if (fallback) updates.actions = fallback;
              }
            } else {
              console.warn(`[enrichBillMetadata] No action sentences returned; falling back to raw format for legi_id ${legiId}`);
              const fallback = actions
                .filter((a: any) => a?.date && a?.chamber && a?.action)
                .map((a: any) => `${formatDateWithOrdinalFromMDY(String(a.date))}: ${a.action}`)
                .join(" | ");
              if (fallback) updates.actions = fallback;
            }
          } catch (e) {
            console.error(`[enrichBillMetadata] Failed to format actions into sentences for legi_id ${legiId}:`, e);
            const fallback = actions
              .filter((a: any) => a?.date && a?.chamber && a?.action)
              .map((a: any) => `${formatDateWithOrdinalFromMDY(String(a.date))}: ${a.action}`)
              .join(" | ");
            if (fallback) updates.actions = fallback;
          }
        } else {
          console.warn(`[enrichBillMetadata] No actions found for legi_id ${legiId}. Result:`, actionsResult);
        }
      } else {
        console.warn(`[enrichBillMetadata] Actions page text too short for legi_id ${legiId}: ${actionsText?.length || 0} chars`);
      }
      } catch (e) {
        console.error(`[enrichBillMetadata] Failed to extract actions for legi_id ${legiId}:`, e);
      }
    } else if (skipPopulatedFields && hasActions) {
      console.log(`[enrichBillMetadata] Skipping actions extraction for legi_id ${legiId} (already populated)`);
    }
    };

    await Promise.all([
      doNameNormalization(),
      doSubject(),
      doLatestAction(),
      doCosponsors(),
      doCommittees(),
      doActions(),
    ]);

    // Extract most recent vote from actions and prepend to latest_action
    // (runs after the concurrent extraction above settles, since it reads
    // both updates.actions and updates.latest_action)
    // Check both newly extracted actions (updates.actions) and existing actions from database
    const actionsToCheck = updates.actions 
      ? String(updates.actions)
      : (legiRow?.actions ? String(legiRow.actions) : null);
    
    // Get the latest_action to prepend vote to (either newly extracted or existing)
    const latestActionToUpdate = updates.latest_action 
      ? String(updates.latest_action)
      : (legiRow?.latest_action ? String(legiRow.latest_action) : null);
    
    if (actionsToCheck && latestActionToUpdate) {
      try {
        // Split actions by " | " to get individual action entries
        const actionEntries = actionsToCheck.split(" | ").filter(a => a.trim());
        
        // Find the most recent vote (action containing vote-related keywords)
        let mostRecentVote: string | null = null;
        for (let i = actionEntries.length - 1; i >= 0; i--) {
          const action = actionEntries[i].toLowerCase();
          // Check if this action contains vote-related keywords
          if (
            action.includes("recorded vote") ||
            action.includes("roll no") ||
            action.includes("roll number") ||
            action.includes("passed by") ||
            action.includes("agreed to") ||
            action.includes(" by vote ") ||
            action.includes(" vote of ") ||
            (/\d+\s*-\s*\d+/.test(action) && (action.includes("vote") || action.includes("yea") || action.includes("nay")))
          ) {
            mostRecentVote = actionEntries[i].trim();
            break;
          }
        }
        
        if (mostRecentVote) {
          // Check if latest_action already starts with this vote (avoid duplication)
          const voteText = mostRecentVote.endsWith('.') ? mostRecentVote : `${mostRecentVote}.`;
          if (!latestActionToUpdate.startsWith(mostRecentVote.substring(0, 50))) {
            // Prepend the vote to latest_action with a space
            updates.latest_action = `${voteText} ${latestActionToUpdate}`;
            console.log(
              `[enrichBillMetadata] Prepended most recent vote to latest_action for legi_id ${legiId}: ${mostRecentVote.substring(0, 100)}...`
            );
          } else {
            console.log(`[enrichBillMetadata] Vote already present at start of latest_action for legi_id ${legiId}`);
          }
        } else {
          console.log(`[enrichBillMetadata] No vote found in actions for legi_id ${legiId}`);
        }
      } catch (e) {
        console.error(`[enrichBillMetadata] Failed to extract vote from actions for legi_id ${legiId}:`, e);
        // Continue without prepending vote if extraction fails
      }
    } else if (actionsToCheck) {
      console.log(`[enrichBillMetadata] Cannot prepend vote to latest_action for legi_id ${legiId} (latest_action not available)`);
    }

    // Update legi_index with all extracted metadata (always update data_update timestamp)
    const fieldsToUpdate = Object.keys(updates).filter(k => k !== "data_update");
    console.log(`[enrichBillMetadata] Preparing to update legi_id ${legiId} with fields:`, fieldsToUpdate);
    console.log(`[enrichBillMetadata] Update payload:`, JSON.stringify(updates, null, 2));
    
    const { error: updateErr } = await supabase
      .from("legi_index")
      .update(updates)
      .eq("id", legiId);
    
    if (updateErr) {
      console.error(`[enrichBillMetadata] Failed to update metadata for legi_id ${legiId}:`, updateErr);
    } else {
      const fieldCount = Object.keys(updates).length - 1; // Exclude data_update
      console.log(`[enrichBillMetadata] Successfully enriched metadata for legi_id ${legiId} (${fieldCount} fields updated: ${fieldsToUpdate.join(", ")})`);
    }
  } catch (e) {
    console.error(`Error in enrichBillMetadata for legi_id ${legiId}:`, e);
    // Don't throw - allow caller to continue
  }
}

/** Paths this file writes as a bill synopsis. */
const SYNOPSIS_PATH_RE = /\/synopsis\.\d+\.congress(?:\.\d+)?\.txt$/i;

/** Re-extract the bill's congress.gov page and replace the stored synopsis.
 *
 *  Nothing else does this. handleLegiById only writes a synopsis while one of
 *  sub_name/bill_lvl/bill_status/bill_id/congress is still missing, so once a row is
 *  fully populated its synopsis is frozen at whatever the page said on the day it was
 *  first indexed -- even as the bill picks up actions, amendments and a new status.
 *
 *  The replacement is written before the superseded rows are removed, so a failed
 *  extraction leaves the existing synopsis untouched rather than destroying it. Old
 *  rows are cleared on success because the network path always inserts a new row; some
 *  owners had accumulated five synopsis files from repeated runs. */
async function refreshLegiSynopsis(legiId: number): Promise<{ ok: boolean; written?: number; superseded?: number; error?: string }> {
  try {
    const { data: row, error: rowErr } = await supabase
      .from("legi_index")
      .select("id, name, bill_id, congress")
      .eq("id", legiId)
      .single();
    if (rowErr || !row) return { ok: false, error: `legi_index id ${legiId} not found` };

    const { data: existingRows } = await supabase
      .from("web_content")
      .select("id, path, link")
      .eq("owner_id", legiId)
      .eq("is_ppl", false);
    const oldSynopsis = (existingRows || []).filter((r: any) => SYNOPSIS_PATH_RE.test(String(r?.path || "")));

    // Prefer a stored congress.gov link; fall back to search. Either way the URL has to
    // belong to this bill -- a coverage row can point at an entirely different one.
    const expectedCanon = canonicalBillId(row.bill_id ? String(row.bill_id) : null);
    const belongsToBill = (u: string) => {
      if (!expectedCanon) return true;
      const c = canonicalBillId(billIdFromCongressUrl(u));
      return !!c && c === expectedCanon;
    };

    let url = await latestLegiWebContentLink(legiId);
    if (!url || !belongsToBill(url)) url = null;
    if (!url) {
      const name = String(row.name || "");
      const congressHint = typeof row.congress === "string" ? row.congress.trim() : "";
      const query = `${(row.bill_id || name)} ${congressHint} site:congress.gov`.trim();
      const urls = await tavilySearch(query, ["congress.gov"]);
      const pick = pickCongressUrlRoot(urls);
      if (!pick || !belongsToBill(pick)) {
        return { ok: false, error: `no congress.gov URL matching ${row.bill_id || name}` };
      }
      url = pick;
    }

    const ext = await tavilyExtractOneWithRetryOrHtml(url);
    const text = ext.storedText || "";
    if (!text.trim()) return { ok: false, error: "extraction returned empty content" };

    const ins = await supabase
      .from("web_content")
      .insert({ path: "pending", owner_id: legiId, is_ppl: false, link: url })
      .select("id")
      .single();
    if (ins.error || !ins.data) return { ok: false, error: "web_content insert failed" };
    const webId = ins.data.id as number;

    const storedPaths = await putParts(`legi/${legiId}/synopsis.${webId}.congress`, text);
    if (!storedPaths.length) return { ok: false, error: "storage write produced no parts" };
    await supabase.from("web_content").update({ path: storedPaths[0] }).eq("id", webId);

    // Replacement is stored -- now retire what it supersedes.
    let superseded = 0;
    const doomed = oldSynopsis.filter((r: any) => Number(r.id) !== webId);
    if (doomed.length) {
      const paths = doomed.map((r: any) => String(r.path || "")).filter((x: string) => !!x && x !== "pending");
      if (paths.length) {
        const { error: rmErr } = await supabase.storage.from(WEB_BUCKET).remove(paths);
        if (rmErr) console.warn("[refreshLegiSynopsis] storage remove:", rmErr);
      }
      const { error: delErr } = await supabase.from("web_content").delete().in("id", doomed.map((r: any) => r.id));
      if (delErr) console.warn("[refreshLegiSynopsis] web_content delete:", delErr);
      else superseded = doomed.length;
    }

    return { ok: true, written: storedPaths.length, superseded };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
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
      return new Response("bill_search: POST { title: string, congress_session: number } OR POST { enrich: true, legi_id?: number, legi_ids?: number[] }", { status: 200 });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok:false, error:"Use POST" }), {
        status: 405, headers: { "Content-Type":"application/json" }
      });
    }

    const ctype = req.headers.get("content-type") || "";
    const body = ctype.includes("application/json") ? await req.json().catch(() => ({})) : {};
    
    // ===================== ENRICHMENT ENDPOINT FOR EXISTING BILLS =====================
    // Check for enrichment request (handle both boolean true and string "true")
    const isEnrichmentRequest = body?.enrich === true || body?.enrich === "true" || body?.enrich === 1;
    
    if (isEnrichmentRequest) {
      const legiId = body?.legi_id !== undefined && body?.legi_id !== null ? Number(body.legi_id) : null;
      const legiIds = body?.legi_ids !== undefined && body?.legi_ids !== null 
        ? (Array.isArray(body.legi_ids) ? body.legi_ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0) : null)
        : null;
      
      // Single bill enrichment
      if (legiId !== null && legiId > 0 && (legiIds === null || legiIds.length === 0)) {
        const result = await enrichBillMetadataById(legiId);

        // Opt-in synopsis refresh. Metadata enrichment alone leaves the stored synopsis
        // frozen at first-index time (see refreshLegiSynopsis), so the profile-open path
        // asks for this when the row looks stale.
        const wantSynopsis =
          body?.refresh_synopsis === true || body?.refresh_synopsis === "true" || body?.refresh_synopsis === 1;
        const synopsis = wantSynopsis ? await refreshLegiSynopsis(legiId) : null;

        return new Response(JSON.stringify({
          ok: result.success,
          legi_id: legiId,
          message: result.success ? "Metadata enrichment completed" : "Metadata enrichment failed",
          error: result.error || null,
          synopsis_refresh: synopsis
        }), { headers: { "Content-Type":"application/json" } });
      }
      
      // Batch enrichment (multiple bills)
      if (legiIds && legiIds.length > 0) {
        const results = await runLimited(legiIds, BULK_ENRICH_CONCURRENCY, async (id: number) => {
          const result = await enrichBillMetadataById(id);
          return { legi_id: id, success: result.success, error: result.error };
        });
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);
        
        return new Response(JSON.stringify({
          ok: true,
          total: legiIds.length,
          successful,
          failed: failed.length,
          results
        }), { headers: { "Content-Type":"application/json" } });
      }
      
      // Bulk enrichment (all bills without metadata)
      if (legiId === null && (!legiIds || legiIds.length === 0)) {
        // Find all bills that are missing metadata fields or have old data_update
        const { data: bills, error } = await supabase
          .from("legi_index")
          .select("id")
          .or("subject.is.null,cosponsors.is.null,committees.is.null,actions.is.null,latest_action.is.null,data_update.is.null,sub_name.is.null,bill_id.is.null");
        
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type":"application/json" }
          });
        }
        
        if (!bills || bills.length === 0) {
          return new Response(JSON.stringify({
            ok: true,
            message: "No bills found that need metadata enrichment",
            total: 0
          }), { headers: { "Content-Type":"application/json" } });
        }
        
        const billIds = bills.map(b => b.id);
        const results = await runLimited(billIds, BULK_ENRICH_CONCURRENCY, async (id: number) => {
          const result = await enrichBillMetadataById(id);
          return { legi_id: id, success: result.success, error: result.error };
        });
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);
        
        return new Response(JSON.stringify({
          ok: true,
          total: billIds.length,
          successful,
          failed: failed.length,
          message: `Processed ${billIds.length} bills`
        }), { headers: { "Content-Type":"application/json" } });
      }
      
      return new Response(JSON.stringify({
        ok: false,
        error: "Must provide either 'legi_id' (single bill), 'legi_ids' (array of bill IDs), or neither (enrich all bills missing metadata)"
      }), {
        status: 400, headers: { "Content-Type":"application/json" }
      });
    }
    
    // ===================== ORIGINAL BILL SEARCH ENDPOINT =====================
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
    // expandBillQueryTerms returns a single-element array (the raw input, unchanged)
    // when rawTitle doesn't look like a bill code -- i.e. a free-text title search
    // (the app's search-by-name flow). Only enforce a strict bill-number match below
    // when we actually have a bill code to check against; free-text search has no
    // bill code to compare, so it keeps the looser congress-only matching.
    const expectedCanon = terms.length > 1 ? canonicalBillId(rawTitle) : null;

    const searchOnce = (query: string) =>
      tavilySearch(query, ["congress.gov"]).catch(async () => {
        await sleep(300);
        try { return await tavilySearch(query, ["congress.gov"]); } catch { return []; }
      });

    // ---------- SEARCH congress.gov (pass A: with ordinal, pass B: without) ----------
    const [urlsA, urlsB] = await Promise.all([
      searchOnce(`${orTerms} ${ordinal} site:congress.gov`),
      searchOnce(`${orTerms} site:congress.gov`),
    ]);

    const allUrls = [...urlsA, ...urlsB];

    if (!allUrls.length) {
      return new Response(JSON.stringify({ ok:false, reason:"not_found" }), { headers: { "Content-Type":"application/json" }});
    }

    // ---------- ONE-BY-ONE: pick first candidate whose URL congress (and, when we have
    // a real bill code, bill number) matches ----------
    let root: string | null = null;
    for (const candidate of iterRootsByOrder(allUrls)) {
      const urlCong = congressFromUrl(candidate);
      if (!urlCong || urlCong.toLowerCase() !== ordinal.toLowerCase()) continue;
      if (expectedCanon) {
        const cCanon = canonicalBillId(billIdFromCongressUrl(candidate));
        if (cCanon !== expectedCanon) continue;
      }
      root = candidate;
      break; // stop at the first matching root
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
          const parsedCode = billCodeFromUrl(firstAnyRoot) || parseBillCodeFromText(ext.parseText);
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
    // root was already validated to match the requested congress ordinal, so the URL
    // is the authoritative source for which bill this page is about. Scanning the full
    // page text for a bill-code-looking substring is a fallback only -- pages routinely
    // mention *other* bills (related/companion/similar-bills sections) before their own
    // code appears, and a page-wide regex scan can latch onto one of those instead,
    // producing a name that doesn't match bill_id (which is always URL-derived).
    let billCode = billCodeFromUrl(root);
    if (!billCode) billCode = parseBillCodeFromText(parseText);
    if (!billCode) {
      return new Response(JSON.stringify({ ok:false, reason:"not_found" }), { headers: { "Content-Type":"application/json" }});
    }
    const nameNoSpaces = canonicalNoSpaces(billCode); // "H.R.1"

    // ---------- OPTIONAL WORD TITLE (for human-readable name) ----------
    const wordTitle = extractBillWordTitleFromText(parseText, billCode);
    const displayName = normalizeDisplayTitle(wordTitle, billCode) ?? nameNoSpaces;

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

    // ---------- INSERT legi_index (id, name, congress, created_at) ----------
    {
      const { error: insErr } = await supabase
        .from("legi_index")
        .insert({ 
          id: legiId, 
          name: displayName, 
          congress: ordinal,
          created_at: new Date().toISOString()
        });
      if (insErr) {
        return new Response(JSON.stringify({ ok:false, reason:"insert_failed" }), {
          status: 500, headers: { "Content-Type":"application/json" }
        });
      }
    }

    // ---------- SEND NOTIFICATIONS TO ALL USERS (fire-and-forget) — same pattern as new-card notifications ----------
    (async () => {
      try {
        // Fetch all users with notifications enabled (same as bill_cards / ppl_card_gen)
        const { data: usersWithNotifications } = await supabase
          .from('users')
          .select('uuid')
          .eq('notifications_enabled', true);
        
        if (!usersWithNotifications || usersWithNotifications.length === 0) {
          console.log(`[bill_search] No users with notifications enabled`);
          return;
        }
        
        const enabledUserIds = usersWithNotifications.map(u => u.uuid);
        
        // Message style matches working "new cards" notifications: "[Event] for [profile]. Come check it out!"
        const message = `A new legislation profile has been added for ${displayName}. Come check it out!`;
        const title = `New Legislation Profile: ${displayName}`;
        const body = `A new legislation profile for ${displayName} has been added, come check it out!`;
        
        // Insert notification records for all users with notifications enabled (same as card-gen)
        const notificationRecords = enabledUserIds.map(userId => ({
          user_id: userId,
          profile_id: `legi${legiId}`,
          profile_name: displayName,
          is_ppl: false,
          message: message,
          categories: []
        }));
        
        await supabase.from('notifications').insert(notificationRecords);
        console.log(`[bill_search] Created notifications for ${enabledUserIds.length} users`);
        
        // Send push notifications via Expo API (only for users with tokens)
        const { data: pushTokens } = await supabase
          .from('user_push_tokens')
          .select('push_token, user_id')
          .in('user_id', enabledUserIds);
        
        if (pushTokens && pushTokens.length > 0) {
          // Send push notifications and inspect each ticket so a stale
          // (uninstalled/unregistered) token doesn't fail silently forever.
          const pushResults = await Promise.all(pushTokens.map(async (tokenData) => {
            const pushMsg = {
              to: tokenData.push_token,
              sound: 'notification.wav',
              title: title,
              body: body,
              data: { navigateTo: 'notifications' },
              badge: 1,
            };
            try {
              const res = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Accept-Encoding': 'gzip, deflate',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(pushMsg),
              });
              const json = await res.json().catch(() => null);
              return { push_token: tokenData.push_token, ticket: json?.data };
            } catch (e) {
              console.error('[bill_search] Push send failed:', e);
              return { push_token: tokenData.push_token, ticket: null };
            }
          }));

          const staleTokens = pushResults
            .filter(r => r.ticket?.status === 'error' && r.ticket?.details?.error === 'DeviceNotRegistered')
            .map(r => r.push_token);
          if (staleTokens.length > 0) {
            await supabase.from('user_push_tokens').delete().in('push_token', staleTokens);
            console.log(`[bill_search] Pruned ${staleTokens.length} stale push token(s)`);
          }

          console.log(`[bill_search] Sent ${pushTokens.length} push notifications`);
        }
      } catch (err) {
        console.error('[bill_search] Error sending notifications:', err);
      }
    })();

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
    let enrichment: any = { id: legiId, updated: {}, error: null };
    try {
      enrichment = await handleLegiById(legiId);
      console.log(`Enrichment successful for legi_id ${legiId}:`, enrichment);
    } catch (enrichErr: any) {
      console.error(`Enrichment failed for legi_id ${legiId}:`, enrichErr);
      enrichment.error = enrichErr?.message || String(enrichErr);
      // Continue anyway - the entry was created successfully, enrichment can be retried later
    }

    // ===================== ENRICH METADATA (subject, latest_action, cosponsors, committees, actions) =====================
    try {
      await enrichBillMetadata(legiId, root);
      console.log(`Metadata enrichment completed for legi_id ${legiId}`);
    } catch (metadataErr: any) {
      console.error(`Metadata enrichment failed for legi_id ${legiId}:`, metadataErr);
      // Continue anyway - bill creation was successful, metadata can be retried later
    }

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
    // Distinct from a genuine "no such bill": this is an internal failure (Mistral 429,
    // Tavily timeout, storage error). Reporting both as "not_found" made an upstream rate
    // limit indistinguishable from a missing bill, so callers could not tell which
    // attempts were worth retrying. Clients that don't recognise a reason fall through to
    // `error`, which carries the real message.
    return new Response(JSON.stringify({ ok:false, reason:"internal_error", error: e?.message || String(e) }), {
      status: 200, headers: { "Content-Type":"application/json" }
    });
  }
});
