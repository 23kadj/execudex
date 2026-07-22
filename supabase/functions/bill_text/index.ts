/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";

/** Hard split size per stored part (exact char slicing) */
const PART_LEN = 110_000;

/** Concurrency for uploads */
const CONCURRENCY = 2;

/** Paths this function owns. Everything else stored under legi/<id>/ -- notably
 *  synopsis.<id>.congress.txt, which bill_overview builds the bill overview from --
 *  is written by other functions, is not a bill-text part, and must never be counted
 *  as one here nor removed by this function. */
const BILLTEXT_PATH_RE = /\/billtext\.\d+\.congress(?:\.\d+)?\.txt$/i;

/** ========================== CLIENT ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function readIdAndFlags(req: Request): Promise<{ id: number; force: boolean }> {
  const url = new URL(req.url);
  let id: number | null = null;

  const qId = url.searchParams.get("id");
  if (qId && /^\d+$/.test(qId)) id = Number(qId);

  const ctype = req.headers.get("content-type") || "";
  if (!id && ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (typeof j?.id === "number") id = j.id;
    else if (typeof j?.id === "string" && /^\d+$/.test(j.id)) id = Number(j.id);
  } else if (!id) {
    const raw = (await req.text().catch(() => "")).trim();
    if (/^\d+$/.test(raw)) id = Number(raw);
  }

  if (!id || !Number.isFinite(id)) {
    throw new Error("Missing or invalid id. Provide as JSON { id }, query ?id=, or raw numeric body.");
  }

  const force = url.searchParams.get("force") === "true";
  return { id, force };
}

function splitIntoParts(text: string, size = PART_LEN): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts.length ? parts : [text];
}

/** Tavily search (congress.gov only) */
async function tavilySearchCongress(name: string): Promise<string[]> {
  const body: any = {
    api_key: TAVILY_API_KEY,
    query: name,
    search_depth: "basic",
    max_results: 10,
    include_answer: false,
    include_domains: ["congress.gov"],
  };
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  const data = await res.json();
  const results: { url: string }[] = data.results || [];
  return results.map((r) => r.url).filter(Boolean);
}

/** Tavily extract (markdown preferred). Two attempts. */
async function tavilyExtractText(url: string): Promise<string> {
  const attempt = async () => {
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
  };
  try {
    const t1 = await attempt();
    if (t1 && t1.trim()) return t1;
  } catch (e) {
    console.warn("tavily extract try#1 failed:", e);
  }
  try {
    const t2 = await attempt();
    if (t2 && t2.trim()) return t2;
  } catch (e) {
    console.warn("tavily extract try#2 failed:", e);
  }
  return "";
}

/** Jina Reader fallback (plain text) — only used if Tavily returns empty. */
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
  const text = await r.text();
  return typeof text === "string" ? text : "";
}

/** Extract bill text: prefer Tavily; fallback to Jina if empty. */
async function extractBillText(url: string): Promise<{ text: string; source: "tavily" | "jina" }> {
  const t = await tavilyExtractText(url);
  if (t && t.trim()) return { text: t, source: "tavily" };
  const j = await fetchViaJinaReader(url);
  if (j && j.trim()) return { text: j, source: "jina" };
  throw new Error("Extraction empty after Tavily and Jina");
}

/** Normalize any congress.gov bill URL to canonical /text (latest only). */
function normalizeCongressToText(u: string): string | null {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./i, "www.");
    if (host !== "www.congress.gov") return null;
    // match: /bill/<119th-congress>/<house-bill|senate-bill|...>/<number>[/*]
    const m = url.pathname.match(/^\/bill\/\d+(?:st|nd|rd|th)-congress\/[a-z-]+\/\d+(?:\/.*)?$/i);
    if (!m) return null;
    const base = m[0].replace(/\/+$/, "");
    const parts = base.split("/").slice(0, 5); // ["", "bill", "<congress>", "<type>", "<num>"]
    if (parts.length < 5) return null;
    const rebuilt = `https://www.congress.gov${parts.join("/")}/text`;
    return rebuilt;
  } catch {
    return null;
  }
}

/** legi_index.bill_id prefix -> congress.gov URL segment. Covers every prefix present
 *  in legi_index today (H.R., S., H.Res., S.Res., H.J.Res., S.J.Res., H.Con.Res.,
 *  S.Con.Res.). Anchored so "S." can't swallow "S.Con.Res.". */
const BILL_TYPE_SEGMENTS: Array<[RegExp, string]> = [
  [/^h\.?r\.?$/i,          "house-bill"],
  [/^s\.?$/i,              "senate-bill"],
  [/^h\.?res\.?$/i,        "house-resolution"],
  [/^s\.?res\.?$/i,        "senate-resolution"],
  [/^h\.?j\.?res\.?$/i,    "house-joint-resolution"],
  [/^s\.?j\.?res\.?$/i,    "senate-joint-resolution"],
  [/^h\.?con\.?res\.?$/i,  "house-concurrent-resolution"],
  [/^s\.?con\.?res\.?$/i,  "senate-concurrent-resolution"],
];

/** Split "H.R.2808" into its congress.gov segment ("house-bill") and number ("2808"). */
function parseBillId(billId: string | null | undefined): { segment: string; number: string } | null {
  const raw = String(billId || "").replace(/\s+/g, "");
  const m = raw.match(/^([A-Za-z.]+?)(\d+)$/);
  if (!m) return null;
  for (const [re, segment] of BILL_TYPE_SEGMENTS) {
    if (re.test(m[1])) return { segment, number: m[2] };
  }
  return null;
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/** "119th" | "119" -> "119th". Null when there's no usable number. */
function parseCongressOrdinal(congress: string | null | undefined): string | null {
  const m = String(congress || "").match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 999) return null;
  return `${n}${ordinalSuffix(n)}`;
}

/** Pull the bill's type segment + number back out of a congress.gov URL. */
function billRefFromUrl(u: string): { segment: string; number: string; ordinal: string } | null {
  try {
    const url = new URL(u);
    if (url.hostname.replace(/^www\./i, "") !== "congress.gov") return null;
    const m = url.pathname.match(/^\/bill\/(\d+(?:st|nd|rd|th))-congress\/([a-z-]+)\/(\d+)/i);
    if (!m) return null;
    return { ordinal: m[1].toLowerCase(), segment: m[2].toLowerCase(), number: m[3] };
  } catch {
    return null;
  }
}

/** The bill's own identity, not a stored link, is the authority on which page to fetch.
 *  Returns null when bill_id/congress can't be parsed, in which case callers fall back
 *  to stored-link/Tavily discovery -- still gated by urlMatchesBill below. */
function buildCanonicalTextUrl(billId: string | null | undefined, congress: string | null | undefined): string | null {
  const ref = parseBillId(billId);
  const ord = parseCongressOrdinal(congress);
  if (!ref || !ord) return null;
  return `https://www.congress.gov/bill/${ord}-congress/${ref.segment}/${ref.number}/text`;
}

/** Identity gate: does this URL actually point at the bill we are storing text for?
 *  Nothing was checking this, which is how one legi row ended up holding another
 *  bill's text. Permissive only when bill_id is unparseable (nothing to compare). */
function urlMatchesBill(u: string, billId: string | null | undefined, congress: string | null | undefined): boolean {
  const ref = parseBillId(billId);
  if (!ref) return true;
  const got = billRefFromUrl(u);
  if (!got) return false;
  if (got.segment !== ref.segment || got.number !== ref.number) return false;
  const ord = parseCongressOrdinal(congress);
  if (ord && got.ordinal !== ord.toLowerCase()) return false;
  return true;
}

/** Quick validity test: GET HTML and ensure 200 + non-empty (not stored). */
async function testUrlValidGET(url: string): Promise<boolean> {
  try {
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
    if (!r.ok) return false;
    const txt = await r.text();
    return !!txt && txt.trim().length > 0;
  } catch {
    return false;
  }
}

/** Upload helper */
async function putToStorage(path: string, content: string) {
  const { error } = await supabase.storage.from(WEB_BUCKET).upload(
    path,
    new Blob([content], { type: "text/plain; charset=utf-8" }),
    { upsert: true, contentType: "text/plain; charset=utf-8" }
  );
  if (error) throw error;
}

/** Check storage file exists by attempting a download. */
async function storageExists(path: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(WEB_BUCKET).download(path);
    if (error) return false;
    const s = await data.text();
    return typeof s === "string";
  } catch {
    return false;
  }
}

/** Limit concurrency for an array of tasks. */
async function runLimited<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const active = new Set<Promise<void>>();

  async function launch() {
    if (idx >= items.length) return;
    const my = idx++;
    const p = (async () => {
      try {
        out[my] = await worker(items[my]);
      } catch (e) {
        // @ts-ignore
        out[my] = null;
        console.warn("worker failed", e);
      }
    })().finally(() => active.delete(p as any));
    active.add(p as any);
    if (active.size >= limit) await Promise.race(active);
    return launch();
  }

  await launch();
  await Promise.all(active);
  return out;
}

/** Parse part index from our filename scheme */
function partIndexFromPath(path: string): number {
  const m = path.match(/\.congress(?:\.(\d+))?\.txt$/i);
  if (!m) return 1;
  const n = m[1] ? Number(m[1]) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Determine if a set of paths looks contiguous (1..N) and all exist in storage. */
async function pathsHealthy(paths: string[]): Promise<boolean> {
  if (!paths.length) return false;
  const idxs = paths.map(partIndexFromPath);
  const max = Math.max(...idxs);
  const expect = new Set<number>(Array.from({ length: max }, (_, i) => i + 1));
  for (const n of idxs) expect.delete(n);
  if (expect.size > 0) return false;
  const exists = await Promise.all(paths.map((p) => storageExists(p)));
  return exists.every(Boolean);
}

/** Delete web_content rows + their storage files. */
async function deleteWebRowsAndFiles(rows: Array<{ id: number; path?: string | null }>): Promise<void> {
  if (!rows.length) return;
  const paths = rows.map((r) => String(r.path || "")).filter((p) => !!p && p !== "pending");
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from(WEB_BUCKET).remove(paths);
    if (rmErr) console.warn("storage remove error:", rmErr);
  }
  const ids = rows.map((r) => r.id);
  const { error: delErr } = await supabase.from("web_content").delete().in("id", ids);
  if (delErr) console.warn("web_content delete error:", delErr);
}

/** Create web_content rows and upload all parts (concurrency-limited). */
async function writeParts(ownerId: number, link: string, parts: string[]) {
  type Out = { web_id: number; path: string; length: number };
  const outputs: Out[] = [];

  // First create all rows (to get ids), concurrency-limited
  const rowResults = await runLimited(parts, CONCURRENCY, async (): Promise<Out> => {
    const ins = await supabase
      .from("web_content")
      .insert({ path: "pending", owner_id: ownerId, is_ppl: false, link })
      .select("id")
      .single();
    if (ins.error || !ins.data) throw ins.error || new Error("web_content insert failed");
    const webId = ins.data.id as number;
    return { web_id: webId, path: "", length: 0 };
  });

  // Then upload each part (concurrency-limited); order doesn't matter for storage writes
  const uploadJobs = rowResults.map((rr, i) => ({ rr, part: parts[i], i }));
  const uploadResults = await runLimited(uploadJobs, CONCURRENCY, async ({ rr, part, i }): Promise<Out | null> => {
    if (!rr) return null;
    const webId = rr.web_id;
    const partIdx = parts.length === 1 ? "" : `.${i + 1}`;
    const key = `legi/${ownerId}/billtext.${webId}.congress${partIdx}.txt`;

    await putToStorage(key, part);

    const { error: updErr } = await supabase.from("web_content").update({ path: key }).eq("id", webId);
    if (updErr) console.warn("web_content path update failed:", webId, updErr);

    return { web_id: webId, path: key, length: part.length };
  });

  for (const r of uploadResults) if (r) outputs.push(r);

  return outputs;
}

/** ========================== MAIN HANDLER ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });
    const { id, force } = await readIdAndFlags(req);

    // Deletions are queued here and flushed only once replacement parts have been
    // fetched, validated and written. congress.gov intermittently answers our
    // validation GET with a Cloudflare challenge, and the old delete-then-refetch
    // order meant a single such 403 could wipe an owner's stored evidence and leave
    // nothing behind when the refetch then failed. Only bill-text parts are ever
    // eligible -- this function has no replacement to offer for anything else.
    const pendingDeletions = new Map<number, { id: number; path?: string | null }>();
    const scheduleDeletion = (rows: Array<{ id: number; path?: string | null }>) => {
      for (const r of rows) {
        if (!BILLTEXT_PATH_RE.test(String(r.path || ""))) continue;
        pendingDeletions.set(r.id, r);
      }
    };

    // 1) Get the bill's identity. bill_id + congress are authoritative for which
    // congress.gov page to fetch; name is only used for the Tavily fallback.
    const { data: legi, error: lerr } = await supabase
      .from("legi_index")
      .select("id, name, bill_id, congress")
      .eq("id", id)
      .single();
    if (lerr || !legi?.name) return json(404, { error: `legi_index id ${id} not found or missing name` });

    // 2) Existing congress links (pre-search path)
    const { data: existingRowsAll, error: wcErr } = await supabase
      .from("web_content")
      .select("id, path, link, owner_id")
      .eq("owner_id", id)
      .eq("is_ppl", false)
      .order("id", { ascending: true });
    if (wcErr) throw wcErr;

    // Ordered deterministically, billtext rows first. This query had no ORDER BY, so
    // which stored link won was up to Postgres -- and coverage rows routinely link to
    // *other* bills, so the winner could differ between runs on identical data.
    const existingCongress = (existingRowsAll || [])
      .filter((r) => typeof r?.link === "string" && /congress/i.test(r.link || ""))
      .sort((a, b) => {
        const aBt = BILLTEXT_PATH_RE.test(String(a.path || "")) ? 0 : 1;
        const bBt = BILLTEXT_PATH_RE.test(String(b.path || "")) ? 0 : 1;
        return aBt - bBt || Number(a.id) - Number(b.id);
      });

    // First stored candidate that normalizes to /text *and* belongs to this bill.
    let candidateLink: string | null = null;
    for (const r of existingCongress) {
      const norm = normalizeCongressToText(String(r.link));
      if (!norm) continue;
      if (!urlMatchesBill(norm, legi.bill_id, legi.congress)) continue;
      candidateLink = norm;
      break;
    }

    // 3) Resolve the canonical /text URL: derive it from the bill's identity when we
    // can, else fall back to a stored link, else search.
    const derivedTextUrl = buildCanonicalTextUrl(legi.bill_id, legi.congress);
    let canonicalTextUrl: string | null = null;
    let urlSource: "derived" | "stored_link" | "tavily" | null = null;
    let usedPreExisting = false;

    if (derivedTextUrl) {
      // Deliberately not gated on testUrlValidGET: that GET is the one congress.gov
      // intermittently answers with a Cloudflare 403, and letting a transient block
      // veto a correctly-derived URL would push us into search -- trading a retryable
      // failure for the risk of storing some other bill's text.
      canonicalTextUrl = derivedTextUrl;
      urlSource = "derived";
      usedPreExisting = candidateLink === derivedTextUrl;
    } else if (candidateLink) {
      const ok = await testUrlValidGET(candidateLink);
      if (ok) {
        canonicalTextUrl = candidateLink;
        urlSource = "stored_link";
        usedPreExisting = true;
      } else {
        // invalid (or challenged) -> queue this owner's bill-text parts and search anew.
        // Nothing is removed unless the search and extraction below both succeed.
        scheduleDeletion(existingCongress.map(r => ({ id: r.id, path: r.path })));
      }
    }

    if (!canonicalTextUrl) {
      const urls = await tavilySearchCongress(String(legi.name));
      const normalized = urls.map(normalizeCongressToText).filter((u): u is string => !!u);
      // legi_index.name is a bare bill code for most rows (and blocked-page text for a
      // few), so search results are only as trustworthy as the identity check.
      canonicalTextUrl = normalized.find((u) => urlMatchesBill(u, legi.bill_id, legi.congress)) || null;
      urlSource = "tavily";
      if (!canonicalTextUrl) return json(404, { error: "No usable congress.gov bill /text URL found." });
    }

    // Final identity gate. Every branch above already checks this; repeating it here
    // means no future path can reach extraction holding another bill's URL.
    if (!urlMatchesBill(canonicalTextUrl, legi.bill_id, legi.congress)) {
      return json(409, {
        error: "Resolved URL does not match this bill; refusing to store another bill's text.",
        id,
        bill_id: legi.bill_id ?? null,
        congress: legi.congress ?? null,
        resolved_url: canonicalTextUrl,
      });
    }

    // 4) Delete any OTHER congress links for this owner that don't match the canonical /text
    if (existingCongress.length) {
      const toDelete = existingCongress.filter((r) => {
        const norm = normalizeCongressToText(String(r.link));
        return !norm || norm !== canonicalTextUrl!;
      }).map(r => ({ id: r.id, path: r.path }));
      if (toDelete.length) scheduleDeletion(toDelete);
    }

    // 5) Skip-by-default if healthy parts already exist for this canonical link
    if (!force) {
      const { data: sameLinkRows, error: sameErr } = await supabase
        .from("web_content")
        .select("id, path, link")
        .eq("owner_id", id)
        .eq("is_ppl", false)
        .eq("link", canonicalTextUrl);
      if (sameErr) throw sameErr;

      // Only real bill-text parts count toward "already healthy". Synopsis files are
      // named synopsis.<id>.congress.txt -- they end in .txt and also satisfy
      // partIndexFromPath, so counting one as "part 1" would report the bill as fully
      // stored and skip ever fetching the actual bill text.
      const paths = (sameLinkRows || [])
        .map((r: any) => String(r.path || ""))
        .filter((p) => BILLTEXT_PATH_RE.test(p));

      if (paths.length) {
        const healthy = await pathsHealthy(paths);
        if (healthy) {
          return json(200, {
            id,
            link_used: canonicalTextUrl,
            skipped_reason: "already_present_and_healthy",
            parts_created: [],
            url_source: urlSource,
            queued_deletions_skipped: pendingDeletions.size,
            notes: usedPreExisting ? "validated pre-existing /text link" : "found via Tavily (already stored)",
          });
        } else {
          // partial/gappy -> queue for rebuild; dropped only once new parts are written
          scheduleDeletion((sameLinkRows || []).map((r: any) => ({ id: r.id, path: r.path })));
        }
      }
    } else {
      // force=true -> delete any rows for this canonical link before rebuild
      const { data: sameLinkRows } = await supabase
        .from("web_content")
        .select("id, path")
        .eq("owner_id", id)
        .eq("is_ppl", false)
        .eq("link", canonicalTextUrl);
      if (sameLinkRows?.length) scheduleDeletion(sameLinkRows as any[]);
    }

    // 6) Extract bill text (Tavily; fallback to Jina)
    const { text, source } = await extractBillText(canonicalTextUrl);
    if (!text || !text.trim()) return json(422, { error: "Extraction returned empty content." });

    // 7) Split & persist (row-per-part)
    const parts = splitIntoParts(text, PART_LEN);
    const outputs = await writeParts(id, canonicalTextUrl, parts);

    // 8) The replacement is stored -- only now is it safe to drop what it supersedes.
    // writeParts swallows per-part failures, so require a *complete* set: a partial
    // write is not a replacement, and dropping the old rows for one would leave the
    // owner with gappy text instead of the evidence it already had.
    const replacementComplete = outputs.length === parts.length;
    let superseded = 0;
    if (replacementComplete && pendingDeletions.size) {
      const doomed = [...pendingDeletions.values()].filter(
        (r) => !outputs.some((o) => o.web_id === r.id)
      );
      await deleteWebRowsAndFiles(doomed);
      superseded = doomed.length;
    }

    return json(200, {
      id,
      link_used: canonicalTextUrl,
      extraction_source: source, // "tavily" | "jina"
      url_source: urlSource,     // "derived" | "stored_link" | "tavily"
      parts_created: outputs,    // [{ web_id, path, length }]
      parts_expected: parts.length,
      superseded_rows_deleted: superseded,
      superseded_rows_kept: replacementComplete ? 0 : pendingDeletions.size,
    });
  } catch (e: any) {
    console.error(e);
    const msg = String(e?.message || e || "unknown error");
    const status =
      /Missing or invalid id/.test(msg) ? 400 :
      /No usable congress\.gov/.test(msg) ? 404 :
      /Extraction returned empty/.test(msg) ? 422 :
      /Extraction empty after Tavily and Jina/.test(msg) ? 422 :
      500;
    return json(status, { error: msg });
  }
});
