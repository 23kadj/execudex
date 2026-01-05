/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";

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

// Validate URL matches required format: justfacts.votesmart.org/bill/... with title in path
function isValidVoteSmartBillUrl(url: string, title: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Must be justfacts.votesmart.org (or www.justfacts.votesmart.org)
    if (!hostname.includes("justfacts.votesmart.org")) {
      return false;
    }
    
    const pathname = urlObj.pathname.toLowerCase();
    const pathSegments = pathname.split("/").filter(Boolean);
    
    // First segment after .org/ must be "bill"
    if (pathSegments.length === 0 || pathSegments[0] !== "bill") {
      return false;
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

    // Fetch card from card_index to get title and owner_id
    const { data: card, error: cardError } = await supabase
      .from("card_index")
      .select("id, title, owner_id, is_ppl")
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
    const validUrls = searchUrls.filter(url => isValidVoteSmartBillUrl(url, title));
    
    if (validUrls.length === 0) {
      console.log(`[RECORDS_OPEN] No valid Vote Smart bill URLs found in search results`);
      return json(200, { error: "This voting record is currently unavailable.", success: false });
    }

    // Use the first valid URL from search results
    const targetUrl = validUrls[0];
    console.log(`[RECORDS_OPEN] Extracting from: ${targetUrl}`);

    // Extract content from the URL
    let scrapedContent: string = "";
    try {
      scrapedContent = await tavilyExtract(targetUrl);
      if (!scrapedContent || scrapedContent.trim().length === 0) {
        console.log(`[RECORDS_OPEN] No content extracted`);
        return json(200, { error: "This voting record is currently unavailable.", success: false });
      }
    } catch (extractErr) {
      console.error(`[RECORDS_OPEN] Extract error:`, extractErr);
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

