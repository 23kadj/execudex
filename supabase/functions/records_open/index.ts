/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";
/** Optional: higher RPM for https://r.jina.ai Reader (Votesmart often blocks direct Edge fetches with 403). */
const JINA_API_KEY = Deno.env.get("JINA_API_KEY") || "";

/** Timeouts */
const SEARCH_TIMEOUT_MS = 10_000;
const EXTRACT_TIMEOUT_MS = 15_000;
const PART_LEN = 110_000; // max chars per stored part

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function bareDomainLabelFromUrl(u: string): string {
  const host = hostOf(u);
  const parts = host.split(".");
  if (parts.length >= 2) {
    return parts[parts.length - 2]; // e.g., "votesmart" from "votesmart.org"
  }
  return host.replace(/[^a-z0-9]/g, "");
}

// Slugify a title (convert to dash-separated lowercase)
function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isVoteSmartDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "votesmart.org" || host.endsWith(".votesmart.org");
}

// Validate URL matches VoteSmart bill format /bill/... with optional title matching for search results.
function isValidVoteSmartBillUrl(url: string, title: string, requireTitleMatch = true): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Must be votesmart domain
    if (!isVoteSmartDomain(hostname)) {
      return false;
    }
    
    const pathname = urlObj.pathname.toLowerCase();
    const pathSegments = pathname.split("/").filter(Boolean);
    
    // First segment after .org/ must be "bill"
    if (pathSegments.length === 0 || pathSegments[0] !== "bill") {
      return false;
    }
    
    if (!requireTitleMatch) {
      return true;
    }

    // Check if title (or significant parts) appears in the URL path
    const titleSlug = slugify(title);
    const titleWords = titleSlug.split("-").filter(w => w.length > 3); // Filter out short words
    
    // Check if at least 2 significant words from the title appear in the path
    const pathStr = pathname;
    let matchingWords = 0;
    for (const word of titleWords) {
      if (pathStr.includes(word)) {
        matchingWords++;
      }
    }
    
    if (titleWords.length === 0) {
      return true;
    }

    // Require at least 2 matching words, or if title is short, require at least 1
    const minMatches = titleWords.length > 3 ? 2 : 1;
    return matchingWords >= minMatches;
    
  } catch (e) {
    console.warn(`[RECORDS_OPEN] Error parsing URL ${url}:`, e);
    return false;
  }
}

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
async function tavilySearch(query: string): Promise<string[]> {
  const body: any = {
    api_key: TAVILY_API_KEY,
    query,
    max_results: 5,
    search_depth: "basic",
  };
  const r = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: SEARCH_TIMEOUT_MS,
  });
  if (!r || !r.ok) throw new Error(`Tavily search error ${r?.status}`);
  const j = await r.json();
  const list = j?.results || j?.data || [];
  return list.map((x: any) => String(x?.url || "")).filter(Boolean);
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
  return content;
}

/** Same host/path on justfacts vs www for bill pages — Tavily often works on one and not the other. */
function alternateVoteSmartBillUrls(url: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };
  try {
    const u = new URL(url);
    if (!isVoteSmartDomain(u.hostname)) {
      push(url);
      return out;
    }
    const path = `${u.pathname}${u.search}`;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    push(url);
    if (host === "votesmart.org") {
      push(`https://justfacts.votesmart.org${path}`);
    } else if (host === "justfacts.votesmart.org") {
      push(`https://votesmart.org${path}`);
    }
  } catch {
    push(url);
  }
  return out;
}

function roughHtmlToText(html: string): string {
  let s = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, " ");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, " ");
  s = s.replace(/<[^>]+>/g, "\n");
  s = s.replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

async function fetchViaJinaReader(url: string): Promise<string> {
  // https://r.jina.ai/https://example.com — browser-backed fetch; avoids Votesmart Edge IP blocks.
  const readerUrl = `https://r.jina.ai/${url}`;
  const headers: Record<string, string> = {
    Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.8",
  };
  if (JINA_API_KEY.trim()) {
    headers.Authorization = `Bearer ${JINA_API_KEY.trim()}`;
  }
  const res = await fetchWithTimeout(readerUrl, {
    method: "GET",
    headers,
    redirect: "follow",
    timeoutMs: Math.max(EXTRACT_TIMEOUT_MS, 45_000),
  });
  if (!res || !res.ok) {
    throw new Error(`Jina reader HTTP ${res?.status}`);
  }
  const text = (await res.text()).trim();
  if (text.length < 400) {
    throw new Error(`Jina reader body too short (${text.length} chars)`);
  }
  return text;
}

async function fetchVoteSmartPageAsFallbackText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    timeoutMs: EXTRACT_TIMEOUT_MS,
  });
  if (!res || !res.ok) throw new Error(`direct fetch HTTP ${res?.status}`);
  const html = await res.text();
  const text = roughHtmlToText(html);
  if (text.trim().length < 400) {
    throw new Error(`direct fetch body too short (${text.trim().length} chars)`);
  }
  return text;
}

/** Try the 3-tier fallback chain (Tavily -> Jina -> direct) for a single URL, sequentially (cost-ordered). */
async function extractFromCandidate(url: string): Promise<{ content: string; finalUrl: string } | null> {
  try {
    const viaTavily = await tavilyExtract(url);
    if (viaTavily.trim().length > 0) {
      console.log(`[RECORDS_OPEN] Tavily extract ok for ${url} (${viaTavily.trim().length} chars)`);
      return { content: viaTavily, finalUrl: url };
    }
  } catch (e) {
    console.log(`[RECORDS_OPEN] tavily failed for ${url}: ${e}`);
  }

  try {
    const viaJina = await fetchViaJinaReader(url);
    console.log(`[RECORDS_OPEN] Jina reader ok for ${url} (${viaJina.trim().length} chars)`);
    return { content: viaJina, finalUrl: url };
  } catch (e) {
    console.log(`[RECORDS_OPEN] jina failed for ${url}: ${e}`);
  }

  try {
    const viaDirect = await fetchVoteSmartPageAsFallbackText(url);
    console.log(`[RECORDS_OPEN] Direct fetch ok for ${url} (${viaDirect.trim().length} chars)`);
    return { content: viaDirect, finalUrl: url };
  } catch (e) {
    console.log(`[RECORDS_OPEN] direct failed for ${url}: ${e}`);
  }

  return null;
}

/**
 * Tavily extract is flaky on some votesmart.org URLs. Try every seed's URL
 * variants concurrently (bounded batches) instead of one at a time — the
 * original version tried every candidate's full 3-tier chain sequentially
 * (seed by seed, variant by variant), which could take minutes in the worst
 * case (each tier has its own multi-second timeout) when the first several
 * candidates all failed. Each candidate's own tiers still run in cost order
 * (cheap Tavily first), only the candidates run in parallel with each other.
 */
async function extractBillContentWithFallbacks(seedUrls: string[]): Promise<{ content: string; finalUrl: string }> {
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const seed of seedUrls) {
    for (const alt of alternateVoteSmartBillUrls(seed)) {
      if (!seen.has(alt)) {
        seen.add(alt);
        candidates.push(alt);
      }
    }
  }

  if (!candidates.length) throw new Error("no candidate URLs");

  const CONCURRENCY = 4;
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((url) => extractFromCandidate(url)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) return r.value;
    }
  }

  console.error(`[RECORDS_OPEN] All extraction fallbacks failed for seeds:`, seedUrls);
  throw new Error("empty extract after fallbacks");
}

/** ========================== STORAGE ========================== */
async function putParts(basePath: string, content: string): Promise<string[]> {
  const parts: string[] = [];
  for (let i = 0; i < content.length; i += PART_LEN) {
    parts.push(content.slice(i, i + PART_LEN));
  }

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

/** ========================== MAIN HANDLER ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Use POST", success: false });
    }

    const body = await req.json().catch(() => ({}));
    const cardId = body.card_id ? Number(body.card_id) : null;

    if (!cardId) {
      return json(400, { error: "Missing required field: card_id", success: false });
    }

    // Fetch card from card_index to get title, owner, and existing link (if available)
    const { data: card, error: cardError } = await supabase
      .from("card_index")
      .select("id, title, owner_id, is_ppl, link")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return json(404, { error: "Card not found", success: false });
    }

    const title = String(card.title || "").trim();
    if (!title) {
      return json(400, { error: "Card title is empty", success: false });
    }

    const ownerId = card.owner_id;
    const isPpl = card.is_ppl ?? true;
    const existingLink = String(card.link || "").trim();

    let extractionSeeds: string[] = [];
    if (existingLink && isValidVoteSmartBillUrl(existingLink, title, false)) {
      extractionSeeds.push(existingLink);
      console.log(`[RECORDS_OPEN] Stored card link seed for extraction: ${existingLink}`);
    } else if (existingLink) {
      console.log(`[RECORDS_OPEN] Stored card link is not a valid VoteSmart bill URL, falling back to search: ${existingLink}`);
    }

    if (extractionSeeds.length === 0) {
      // Perform Tavily search: "{title} votesmart"
      const searchQuery = `${title} votesmart`;
      console.log(`[RECORDS_OPEN] Searching for: ${searchQuery}`);

      let searchUrls: string[] = [];
      try {
        searchUrls = await tavilySearch(searchQuery);
        if (searchUrls.length === 0) {
          console.log(`[RECORDS_OPEN] No search results found`);
          return json(200, { error: "This voting record is currently unavailable.", success: false });
        }
      } catch (searchErr) {
        console.error(`[RECORDS_OPEN] Search error:`, searchErr);
        return json(200, { error: "This voting record is currently unavailable.", success: false });
      }

      // Filter URLs to only include valid Vote Smart bill URLs
      const strictValidUrls = searchUrls.filter(url => isValidVoteSmartBillUrl(url, title, true));
      const fallbackValidUrls = searchUrls.filter(url => isValidVoteSmartBillUrl(url, title, false));
      const validUrls = strictValidUrls.length > 0 ? strictValidUrls : fallbackValidUrls;

      if (validUrls.length === 0) {
        console.log(`[RECORDS_OPEN] No valid Vote Smart bill URLs found in search results`);
        return json(200, { error: "This voting record is currently unavailable.", success: false });
      }

      extractionSeeds = [...new Set(validUrls)];
      console.log(`[RECORDS_OPEN] Extraction seeds from search (${extractionSeeds.length}):`, extractionSeeds);
    }

    let scrapedContent = "";
    let targetUrl = "";
    try {
      const { content, finalUrl } = await extractBillContentWithFallbacks(extractionSeeds);
      scrapedContent = content;
      targetUrl = finalUrl;
      console.log(`[RECORDS_OPEN] Extraction succeeded; using URL: ${targetUrl}`);
    } catch (extractErr) {
      console.error(`[RECORDS_OPEN] Extraction failed for seeds ${extractionSeeds}:`, extractErr);
    }

    if (!scrapedContent.trim() || !targetUrl) {
      console.log(`[RECORDS_OPEN] No content extracted after trying all seeds`);
      return json(200, { error: "This voting record is currently unavailable.", success: false });
    }

    // Create web_content row (insert with path: "pending" first)
    const { data: webContentInsert, error: insertError } = await supabase
      .from("web_content")
      .insert({
        path: "pending",
        owner_id: ownerId,
        is_ppl: isPpl,
        link: targetUrl,
        used: false,
      })
      .select("id")
      .single();

    if (insertError || !webContentInsert) {
      console.error(`[RECORDS_OPEN] Error inserting web_content:`, insertError);
      return json(200, { error: "This voting record is currently unavailable.", success: false });
    }

    const webId = webContentInsert.id as number;

    // Store content to storage: ppl/{owner_id}/voterecord.{webId}.{label}.txt
    const label = bareDomainLabelFromUrl(targetUrl);
    const base = `ppl/${ownerId}/voterecord.${webId}.${label}`;
    let storedPaths: string[] = [];

    try {
      storedPaths = await putParts(base, scrapedContent);
      if (storedPaths.length === 0) {
        console.error(`[RECORDS_OPEN] No paths stored`);
        // Clean up web_content row
        await supabase.from("web_content").delete().eq("id", webId);
        return json(200, { error: "This voting record is currently unavailable.", success: false });
      }
    } catch (storageErr) {
      console.error(`[RECORDS_OPEN] Storage error:`, storageErr);
      // Clean up web_content row
      await supabase.from("web_content").delete().eq("id", webId);
      return json(200, { error: "This voting record is currently unavailable.", success: false });
    }

    // Update web_content.path to point at the first part
    const { error: updatePathError } = await supabase
      .from("web_content")
      .update({ path: storedPaths[0] })
      .eq("id", webId);

    if (updatePathError) {
      console.error(`[RECORDS_OPEN] Error updating web_content path:`, updatePathError);
      // Continue anyway - the path might have been set, or we can try to recover
    }

    // Update card_index with link, web_id, and web (path)
    const { error: updateCardError } = await supabase
      .from("card_index")
      .update({
        link: targetUrl,
        web_id: webId,
        web: storedPaths[0],
      })
      .eq("id", cardId);

    if (updateCardError) {
      console.error(`[RECORDS_OPEN] Error updating card_index:`, updateCardError);
      // This is critical - if we can't update card_index, full_card_gen won't work
      return json(200, { error: "This voting record is currently unavailable.", success: false });
    }

    console.log(`[RECORDS_OPEN] Successfully processed card ${cardId}, web_id: ${webId}`);

    return json(200, {
      success: true,
      card_id: cardId,
      web_id: webId,
      web: storedPaths[0],
      link: targetUrl,
    });

  } catch (error) {
    console.error(`[RECORDS_OPEN] Unexpected error:`, error);
    return json(200, { error: "This voting record is currently unavailable.", success: false });
  }
});

