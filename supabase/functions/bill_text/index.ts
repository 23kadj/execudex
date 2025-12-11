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

  // Then upload each part deterministically in original order
  for (let i = 0; i < parts.length; i++) {
    const rr = rowResults[i];
    if (!rr) continue;
    const webId = rr.web_id;
    const partIdx = parts.length === 1 ? "" : `.${i + 1}`;
    const key = `legi/${ownerId}/billtext.${webId}.congress${partIdx}.txt`;

    await putToStorage(key, parts[i]);

    const { error: updErr } = await supabase.from("web_content").update({ path: key }).eq("id", webId);
    if (updErr) console.warn("web_content path update failed:", webId, updErr);

    outputs.push({ web_id: webId, path: key, length: parts[i].length });
  }

  return outputs;
}

/** ========================== MAIN HANDLER ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });
    const { id, force } = await readIdAndFlags(req);

    // 1) Get bill name from legi_index (for Tavily fallback)
    const { data: legi, error: lerr } = await supabase
      .from("legi_index")
      .select("id, name")
      .eq("id", id)
      .single();
    if (lerr || !legi?.name) return json(404, { error: `legi_index id ${id} not found or missing name` });

    // 2) Existing congress links (pre-search path)
    const { data: existingRowsAll, error: wcErr } = await supabase
      .from("web_content")
      .select("id, path, link, owner_id")
      .eq("owner_id", id)
      .eq("is_ppl", false);
    if (wcErr) throw wcErr;

    const existingCongress = (existingRowsAll || []).filter((r) =>
      typeof r?.link === "string" && /congress/i.test(r.link || "")
    );

    // choose first candidate that normalizes to /text
    let candidateLink: string | null = null;
    for (const r of existingCongress) {
      const norm = normalizeCongressToText(String(r.link));
      if (norm) { candidateLink = norm; break; }
    }

    // 3) Validate candidate or discover via Tavily
    let canonicalTextUrl: string | null = null;
    let usedPreExisting = false;

    if (candidateLink) {
      const ok = await testUrlValidGET(candidateLink);
      if (ok) {
        canonicalTextUrl = candidateLink;
        usedPreExisting = true;
      } else {
        // invalid -> delete ALL congress rows/files for this owner and search anew
        await deleteWebRowsAndFiles(existingCongress.map(r => ({ id: r.id, path: r.path })));
      }
    }

    if (!canonicalTextUrl) {
      const urls = await tavilySearchCongress(String(legi.name));
      const normalized = urls.map(normalizeCongressToText).filter((u): u is string => !!u);
      canonicalTextUrl = normalized[0] || null;
      if (!canonicalTextUrl) return json(404, { error: "No usable congress.gov bill /text URL found." });
    }

    // 4) Delete any OTHER congress links for this owner that don't match the canonical /text
    if (existingCongress.length) {
      const toDelete = existingCongress.filter((r) => {
        const norm = normalizeCongressToText(String(r.link));
        return !norm || norm !== canonicalTextUrl!;
      }).map(r => ({ id: r.id, path: r.path }));
      if (toDelete.length) await deleteWebRowsAndFiles(toDelete);
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

      const paths = (sameLinkRows || [])
        .map((r: any) => String(r.path || ""))
        .filter((p) => p.endsWith(".txt"));

      if (paths.length) {
        const healthy = await pathsHealthy(paths);
        if (healthy) {
          return json(200, {
            id,
            link_used: canonicalTextUrl,
            skipped_reason: "already_present_and_healthy",
            parts_created: [],
            notes: usedPreExisting ? "validated pre-existing /text link" : "found via Tavily (already stored)",
          });
        } else {
          // partial/gappy -> rebuild from scratch
          await deleteWebRowsAndFiles((sameLinkRows || []).map((r: any) => ({ id: r.id, path: r.path })));
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
      if (sameLinkRows?.length) await deleteWebRowsAndFiles(sameLinkRows as any[]);
    }

    // 6) Extract bill text (Tavily; fallback to Jina)
    const { text, source } = await extractBillText(canonicalTextUrl);
    if (!text || !text.trim()) return json(422, { error: "Extraction returned empty content." });

    // 7) Split & persist (row-per-part)
    const parts = splitIntoParts(text, PART_LEN);
    const outputs = await writeParts(id, canonicalTextUrl, parts);

    return json(200, {
      id,
      link_used: canonicalTextUrl,
      extraction_source: source, // "tavily" | "jina"
      parts_created: outputs,    // [{ web_id, path, length }]
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
