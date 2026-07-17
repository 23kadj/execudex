/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const FETCH_TIMEOUT_MS = Number(Deno.env.get("WIKI_TIMEOUT_MS") ?? 15000);

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== HELPERS ========================== */

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

/** Strip HTML to text */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tavily extract with one retry; else HTML+UA; else return empty */
async function tavilyExtractOneWithRetryOrHtml(
  url: string
): Promise<{ storedText: string; parseText: string; source: "tavily" | "html" }> {
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
  throw new Error("All extraction fallbacks failed");
}

/** Extract content from congress.gov most-viewed-bills page (HTML scrape fallback --
 * subject to Cloudflare's bot-challenge and requires archive-scoping since the page is a
 * flattened weekly archive going back years). Prefer fetchMostViewedBillsRss() below. */
async function extractMostViewedBills(): Promise<string> {
  const url = "https://www.congress.gov/most-viewed-bills";
  console.log(`Extracting content from ${url}...`);

  try {
    const extracted = await tavilyExtractOneWithRetryOrHtml(url);
    console.log(`Successfully extracted ${extracted.parseText.length} characters from ${url} (source: ${extracted.source})`);
    return extracted.parseText;
  } catch (error) {
    console.error(`Failed to extract from ${url}:`, error);
    throw new Error(`Failed to extract content from most-viewed-bills page: ${error}`);
  }
}

const MOST_VIEWED_RSS_URL = "https://www.congress.gov/rss/most-viewed-bills.xml";

/** Fetch the most-viewed-bills RSS feed directly. Unlike the HTML page, this isn't behind
 * congress.gov's Cloudflare bot-challenge (RSS feeds are served plainly for automated
 * consumption), and it only ever contains the current week's item -- no archive to scope
 * out. Preferred source; the Tavily/HTML scrape above is the fallback if this ever fails
 * (feed discontinued, format change, network issue). */
async function fetchMostViewedBillsRss(): Promise<string> {
  const r = await fetch(MOST_VIEWED_RSS_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ExecudexBot/1.0)" },
  });
  if (!r.ok) throw new Error(`RSS fetch failed: ${r.status}`);
  return await r.text();
}

/** Parse the RSS feed's single <item>: its CDATA description is an <ol> of
 * <a href='.../bill/{ordinal}-congress/...'>{code}</a> [{ordinal}] - {title} entries,
 * in rank order. */
function extractMostViewedBillsFromRss(xml: string): Array<{ bill_id: string; congress: string; congress_num: number; position: number }> {
  const descMatch = xml.match(/<description>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/description>/i);
  if (!descMatch) return [];
  const html = descMatch[1];

  const rowRx = /<a\s+href=['"]([^'"]+)['"]>([^<]+)<\/a>\s*\[(\d+(?:st|nd|rd|th))\]/gi;
  const results: Array<{ bill_id: string; congress: string; congress_num: number; position: number }> = [];
  const seen = new Set<string>();

  let m;
  while ((m = rowRx.exec(html)) !== null) {
    const url = m[1];
    const billCode = m[2].trim().toUpperCase().replace(/\s+/g, "");
    const ordinalFromUrl = congressOrdinalFromUrl(url);
    const ordinalFromBracket = m[3].toLowerCase();
    const congressOrdinal = ordinalFromUrl || ordinalFromBracket; // URL is the more authoritative of the two
    const congressNum = congressToNumber(congressOrdinal);
    if (!billCode || congressNum === null) continue;

    const key = `${billCode}|${congressOrdinal}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ bill_id: billCode, congress: congressOrdinal, congress_num: congressNum, position: results.length });
  }

  return results;
}

/** Extract congress number from ordinal string (e.g., "119th" -> 119) */
function congressToNumber(ordinal: string): number | null {
  const match = ordinal.match(/^(\d+)(?:st|nd|rd|th)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? null : num;
}

/** Extract congress ordinal from congress.gov URL (e.g., ".../118th-congress/..." -> "118th") */
function congressOrdinalFromUrl(u: string): string | null {
  const m = u.match(/\/(\d+(?:st|nd|rd|th))-congress\//i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * The most-viewed-bills page is a weekly archive: every Monday's top-10 list gets its
 * own "### [<date>]" section, going back years, all present in the same flattened HTML
 * (only the first/most recent section is visually expanded in a browser by default --
 * a raw text extraction sees every week concatenated together). Scope to just the first
 * section so results match what's actually visible at the top of the real page, and use
 * each row's own bracketed congress annotation (e.g. "[H.R.4818](.../118th-congress/...)
 * [118th]") instead of a loose whole-page regex scan, since that's already explicit and
 * page-authored rather than inferred by proximity.
 */
function extractMostRecentWeekBills(text: string): Array<{ bill_id: string; congress: string; congress_num: number; position: number }> {
  const headerRx = /^### \[/m;
  const firstHeaderMatch = headerRx.exec(text);
  if (!firstHeaderMatch) return [];

  const startIdx = firstHeaderMatch.index;
  const restRx = /^### \[/m;
  restRx.lastIndex = 0;
  const afterFirst = text.slice(startIdx + 1);
  const secondHeaderMatch = restRx.exec(afterFirst);
  const endIdx = secondHeaderMatch ? startIdx + 1 + secondHeaderMatch.index : text.length;

  const weekBlock = text.slice(startIdx, endIdx);

  // Row shape: "| 1. | [H.R.4818](https://www.congress.gov/bill/118th-congress/house-bill/4818) [118th] | Title |"
  const rowRx = /\|\s*(\d+)\.\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\[(\d+(?:st|nd|rd|th))\]\s*\|/gi;
  const results: Array<{ bill_id: string; congress: string; congress_num: number; position: number }> = [];
  const seen = new Set<string>();

  let m;
  while ((m = rowRx.exec(weekBlock)) !== null) {
    const rank = parseInt(m[1], 10);
    const billCode = m[2].trim().toUpperCase().replace(/\s+/g, "");
    const url = m[3];
    const ordinalFromBracket = m[4].toLowerCase();
    const ordinalFromUrl = congressOrdinalFromUrl(url);
    const congressOrdinal = ordinalFromUrl || ordinalFromBracket; // URL is the more authoritative of the two
    const congressNum = congressToNumber(congressOrdinal);
    if (!billCode || congressNum === null) continue;

    const key = `${billCode}|${congressOrdinal}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      bill_id: billCode,
      congress: congressOrdinal,
      congress_num: congressNum,
      position: Number.isFinite(rank) ? rank : results.length,
    });
  }

  results.sort((a, b) => a.position - b.position);
  return results;
}

/** Parse legislation entries from text file
 * Looks for patterns like: H.R.4776 119th, S.1071 119th, etc.
 * Also handles cases where bill and congress might be on different lines or separated differently
 * Returns array of { bill_id: string, congress: string, congress_num: number, position: number }
 * Position is used to preserve the order from the page (which should be popularity order)
 * Fallback only -- used when the structured most-recent-week parse above finds nothing
 * (e.g. congress.gov changes its markup), since it scans the whole flattened archive and
 * can't tell which week a match came from.
 */
function extractLegislation(text: string): Array<{ bill_id: string; congress: string; congress_num: number; position: number }> {
  const results: Array<{ bill_id: string; congress: string; congress_num: number; position: number }> = [];
  
  // Pattern 1: Bill code directly followed by congress ordinal (most common)
  // Matches: H.R.4776 119th, S.1071 119th, H.Res.123 118th, H.R. 4776 119th, etc.
  const pattern1 = /\b(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.|H\.Res\.|S\.Res\.)\s*\.?\s*(\d{1,5})\s+(\d+(?:st|nd|rd|th))\b/gi;
  
  // Pattern 2: Bill code with congress ordinal nearby (within 50 chars)
  // First extract all bill codes
  const billPattern = /\b(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.|H\.Res\.|S\.Res\.)\s*\.?\s*(\d{1,5})\b/gi;
  
  // Extract all congress ordinals
  const congressPattern = /\b(\d+(?:st|nd|rd|th))\s+congress\b/gi;
  
  const seen = new Set<string>();
  let position = 0;
  
  // Try pattern 1 first (direct match) - preserve order by using match index
  let match;
  const matches: Array<{ match: RegExpExecArray; position: number }> = [];
  while ((match = pattern1.exec(text)) !== null) {
    matches.push({ match, position: match.index });
  }
  
  // Sort by position to preserve page order (most popular first)
  matches.sort((a, b) => a.position - b.position);
  
  for (const { match: m } of matches) {
    const prefix = m[1].replace(/\s+/g, ""); // Normalize spaces
    const number = m[2];
    const congressOrdinal = m[3].toLowerCase();
    
    // Create bill_id (e.g., "H.R.4776")
    const bill_id = `${prefix}${number}`;
    
    // Convert congress ordinal to number
    const congressNum = congressToNumber(congressOrdinal);
    if (congressNum === null) continue;
    
    // Create unique key to avoid duplicates
    const key = `${bill_id}|${congressOrdinal}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    results.push({
      bill_id,
      congress: congressOrdinal,
      congress_num: congressNum,
      position: position++
    });
  }
  
  // Pattern 2: Extract from congress.gov URLs (e.g., /bill/119th-congress/house-bill/4776)
  // URLs are usually in order on the page, so preserve that order
  const urlPattern = /\/bill\/(\d+(?:st|nd|rd|th))-congress\/(house-bill|senate-bill|house-joint-resolution|senate-joint-resolution|house-concurrent-resolution|senate-concurrent-resolution|house-resolution|senate-resolution|house-simple-resolution|senate-simple-resolution)\/(\d{1,5})\b/gi;
  
  const urlMatches: Array<{ match: RegExpExecArray; position: number }> = [];
  let urlMatch;
  while ((urlMatch = urlPattern.exec(text)) !== null) {
    urlMatches.push({ match: urlMatch, position: urlMatch.index });
  }
  
  // Sort by position to preserve page order
  urlMatches.sort((a, b) => a.position - b.position);
  
  for (const { match: urlM } of urlMatches) {
    const congressOrdinal = urlM[1].toLowerCase();
    const billType = urlM[2];
    const billNumber = urlM[3];
    
    // Map URL types to bill prefixes
    const typeMap: Record<string, string> = {
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
    
    const prefix = typeMap[billType];
    if (!prefix) continue;
    
    const bill_id = `${prefix}${billNumber}`;
    const congressNum = congressToNumber(congressOrdinal);
    if (congressNum === null) continue;
    
    const key = `${bill_id}|${congressOrdinal}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    results.push({
      bill_id,
      congress: congressOrdinal,
      congress_num: congressNum,
      position: position++
    });
  }
  
  // Pattern 3: If still nothing, try matching bills with nearby congress numbers
  if (results.length === 0) {
    // Find all bill codes with their positions
    const bills: Array<{ prefix: string; number: string; index: number }> = [];
    let billMatch;
    while ((billMatch = billPattern.exec(text)) !== null) {
      bills.push({
        prefix: billMatch[1].replace(/\s+/g, ""),
        number: billMatch[2],
        index: billMatch.index
      });
    }
    
    // Find all congress ordinals with their positions
    const congresses: Array<{ ordinal: string; index: number; num: number }> = [];
    let congMatch;
    while ((congMatch = congressPattern.exec(text)) !== null) {
      const ordinal = congMatch[1].toLowerCase();
      const num = congressToNumber(ordinal);
      if (num !== null) {
        congresses.push({
          ordinal,
          index: congMatch.index,
          num
        });
      }
    }
    
    // Match bills with nearby congress numbers (within 200 characters)
    for (const bill of bills) {
      const bill_id = `${bill.prefix}${bill.number}`;
      
      // Find the closest congress number
      let closestCongress: { ordinal: string; num: number } | null = null;
      let minDistance = Infinity;
      
      for (const cong of congresses) {
        const distance = Math.abs(cong.index - bill.index);
        if (distance < minDistance && distance < 200) {
          minDistance = distance;
          closestCongress = { ordinal: cong.ordinal, num: cong.num };
        }
      }
      
      if (closestCongress) {
        const key = `${bill_id}|${closestCongress.ordinal}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            bill_id,
            congress: closestCongress.ordinal,
            congress_num: closestCongress.num,
            position: position++
          });
        }
      }
    }
  }
  
  // Log a sample of extracted text for debugging (first 500 chars)
  if (results.length === 0 && text.length > 0) {
    const sample = text.substring(0, 500).replace(/\s+/g, " ");
    console.log("Sample of extracted text (first 500 chars):", sample);
  }
  
  // Sort by position to ensure most popular (first on page) are processed first
  results.sort((a, b) => a.position - b.position);
  
  return results;
}

/** Check which legislation entries exist in legi_index */
async function checkExistingLegislation(
  entries: Array<{ bill_id: string; congress: string; position?: number }>
): Promise<Set<string>> {
  const existing = new Set<string>();
  
  // Query in parallel batches to improve performance
  const BATCH_SIZE = 20;
  const batches: Array<Array<{ bill_id: string; congress: string }>> = [];
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    batches.push(entries.slice(i, i + BATCH_SIZE));
  }
  
  // Process batches in parallel
  await Promise.all(
    batches.map(async (batch) => {
      // Check each entry in the batch
      await Promise.all(
        batch.map(async (entry) => {
          const { data, error } = await supabase
            .from("legi_index")
            .select("bill_id, congress")
            .eq("bill_id", entry.bill_id)
            .eq("congress", entry.congress)
            .limit(1);
          
          if (error) {
            console.error(`Error checking ${entry.bill_id} ${entry.congress}:`, error);
            return;
          }
          
          if (data && data.length > 0) {
            const key = `${entry.bill_id}|${entry.congress}`;
            existing.add(key);
          }
        })
      );
    })
  );
  
  return existing;
}

/** Call bill_search edge function for a single legislation */
async function callBillSearch(bill_id: string, congress_num: number): Promise<{ ok: boolean; error?: string; response?: any }> {
  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/bill_search`;
    const requestBody = {
      title: bill_id,
      congress_session: congress_num
    };
    
    console.log(`Sending to bill_search:`, JSON.stringify(requestBody));
    
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE}`
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    console.log(`bill_search response status: ${response.status}`, result);
    
    if (result.ok) {
      return { ok: true, response: result };
    } else {
      return { ok: false, error: result.reason || "Unknown error", response: result };
    }
  } catch (error) {
    console.error(`Error calling bill_search for ${bill_id}:`, error);
    return { ok: false, error: String(error) };
  }
}

/** Best-effort log to bill_update_runs — never throws, so a logging hiccup can't fail the run */
async function logRun(runId: number | null, patch: Record<string, any>): Promise<void> {
  if (runId == null) return;
  try {
    await supabase.from("bill_update_runs").update(patch).eq("id", runId);
  } catch (e) {
    console.warn("Failed to update bill_update_runs:", e);
  }
}

/** Sweep legacy legi_index rows still missing sub_name/bill_id/etc. (fire-and-forget) */
function triggerBackfillSweep(): void {
  fetch(`${SUPABASE_URL}/functions/v1/bill_search`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enrich: true }),
  })
    .then(async (r) => console.log("Backfill sweep triggered:", r.status, await r.text().catch(() => "")))
    .catch((e) => console.warn("Backfill sweep failed to trigger:", e));
}

/** ========================== HTTP HANDLER ========================== */
Deno.serve(async (req) => {
  let runId: number | null = null;
  try {
    if (req.method === "GET") {
      return new Response(
        "bill_update: POST to extract from congress.gov/most-viewed-bills and process legislation. Optional: include additional content in body (text/plain or application/json with 'content' field)",
        { status: 200 }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "Use POST" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Optional run_id — passed by the pg_cron wrapper so this run's outcome can be
    // reconciled against the row it pre-inserted into bill_update_runs. Manual/adhoc
    // invocations (no run_id) skip logging entirely.
    {
      const ctype = req.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const peekBody = await req.clone().json().catch(() => ({}));
        if (typeof peekBody?.run_id === "number") runId = peekBody.run_id;
      }
    }

    // STEP 1: Extract this week's most-viewed bills. Prefer the RSS feed -- no Cloudflare
    // risk, and it only ever contains the current week (no archive-scoping needed). Fall
    // back to the Tavily/HTML scrape only if the feed fails or comes back empty.
    let extracted: Array<{ bill_id: string; congress: string; congress_num: number; position: number }> = [];
    let extractedContent = "";

    try {
      const rssXml = await fetchMostViewedBillsRss();
      extracted = extractMostViewedBillsFromRss(rssXml);
      extractedContent = rssXml;
      console.log(`Extracted ${extracted.length} entries from the most-viewed-bills RSS feed`);
    } catch (error: any) {
      console.warn(`RSS fetch failed (${error?.message || error}), falling back to HTML scrape`);
    }

    if (extracted.length === 0) {
      try {
        extractedContent = await extractMostViewedBills();
      } catch (error: any) {
        await logRun(runId, { status: "error", finished_at: new Date().toISOString(), error: `extract_failed: ${error?.message || String(error)}` });
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Failed to extract from most-viewed-bills page: ${error?.message || String(error)}`
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // STEP 2: Optionally merge with provided file content (if any) -- only meaningful for
    // the HTML-scrape fallback path below, since a successful RSS parse already yields
    // structured entries directly.
    const contentType = req.headers.get("content-type") || "";
    let additionalContent: string = "";
    
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      additionalContent = body.content || body.text || body.data || "";
    } else if (contentType.includes("text/")) {
      // Only read text content if it's explicitly text/plain
      // For other content types, we'll just use the extracted content
      try {
        additionalContent = await req.text();
      } catch {
        // If reading fails, just use extracted content
      }
    }
    
    // Combine extracted content with any additional content provided
    const fileContent = additionalContent.trim() 
      ? `${extractedContent}\n\n${additionalContent}` 
      : extractedContent;

    console.log(`Processing content (${fileContent.length} characters total: ${extractedContent.length} from most-viewed-bills${additionalContent.trim() ? `, ${additionalContent.length} additional` : ""})...`);

    // If the RSS feed already yielded structured entries, use them directly. Otherwise
    // (RSS failed/empty, so extractedContent is the HTML scrape) parse fileContent --
    // prefer the structured, most-recent-week-only parse (matches what's actually visible
    // at the top of the real page); fall back to the whole-archive scan only if that
    // structured parse comes up empty.
    if (extracted.length === 0) {
      extracted = extractMostRecentWeekBills(fileContent);
      if (extracted.length > 0) {
        console.log(`Extracted ${extracted.length} unique legislation entries from the most recent week's section`);
      } else {
        console.log("Most-recent-week parse found nothing, falling back to whole-page scan");
        extracted = extractLegislation(fileContent);
        console.log(`Extracted ${extracted.length} unique legislation entries`);
      }
    }

    // Debug: log first few extracted entries
    if (extracted.length > 0) {
      console.log("Sample extracted entries:", extracted.slice(0, 5).map(e => `${e.bill_id} ${e.congress}`));
    } else {
      // Log a larger sample of the text to help debug
      const sample = fileContent.substring(0, 1000).replace(/\s+/g, " ");
      console.log("No legislation found. Sample text:", sample);
    }

    if (extracted.length === 0) {
      await logRun(runId, { status: "success", finished_at: new Date().toISOString(), summary: { extracted: 0, new: 0, successful: 0 } });
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No legislation entries found in file",
          extracted: 0,
          existing: 0,
          new: 0,
          processed: 0
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Check which entries already exist in legi_index
    const existingKeys = await checkExistingLegislation(extracted);
    console.log(`Found ${existingKeys.size} existing entries in legi_index`);

    // Filter out existing entries
    const newEntries = extracted.filter(entry => {
      const key = `${entry.bill_id}|${entry.congress}`;
      return !existingKeys.has(key);
    });

    console.log(`Found ${newEntries.length} new entries to process`);

    // The pre-filter above under-detects existing bills (older legi_index rows are
    // often missing bill_id, since it's only backfilled by enrichment) — bill_search's
    // own duplicate check catches the rest, but each such "duplicate" burns a candidate
    // for free. Rather than hard-capping at a fixed slice (which can spend its whole
    // budget re-discovering already-known bills), keep walking the candidate list until
    // we land a real target number of new entries, or hit a safety/time cap.
    const TARGET_NEW = 10;
    const MAX_ATTEMPTS = 60;
    const RUN_BUDGET_MS = 100000;
    const startedAt = Date.now();

    const results: Array<{ bill_id: string; congress: string; success: boolean; error?: string; response?: any }> = [];
    let successCount = 0;
    let attempted = 0;
    let nextIdx = 0;

    // Each candidate is dominated by network I/O (Tavily search/extract + Mistral),
    // so processing them one at a time serially (with an extra artificial delay between
    // each) was the main reason a run took over a minute. Run a small bounded-concurrency
    // worker pool instead -- same stop conditions (target/attempts/budget), just launched
    // in parallel rather than queued behind each other.
    const CONCURRENCY = 4;

    async function worker(): Promise<void> {
      for (;;) {
        if (successCount >= TARGET_NEW) return;
        if (attempted >= MAX_ATTEMPTS) return;
        if (Date.now() - startedAt > RUN_BUDGET_MS) return;
        const myIdx = nextIdx++;
        if (myIdx >= newEntries.length) return;
        attempted++;

        const entry = newEntries[myIdx];
        console.log(`Calling bill_search for ${entry.bill_id} (${entry.congress}, congress_num: ${entry.congress_num})...`);
        const result = await callBillSearch(entry.bill_id, entry.congress_num);
        console.log(`bill_search result for ${entry.bill_id}:`, { ok: result.ok, error: result.error, response: result.response });

        if (result.ok) successCount++;
        results.push({
          bill_id: entry.bill_id,
          congress: entry.congress,
          success: result.ok,
          error: result.error,
          response: result.response
        });
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const remaining = newEntries.length - attempted;
    if (remaining > 0) {
      console.log(`Attempted ${attempted} candidates (${successCount} new, ${remaining} remaining for next run)`);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Sweep legacy rows still missing sub_name/bill_id from earlier runs whose
    // enrichment never completed — doesn't block this response.
    triggerBackfillSweep();

    const summary = {
      extracted: extracted.length,
      existing: existingKeys.size,
      new: newEntries.length,
      processed: results.length,
      successful,
      failed,
      remaining: remaining
    };

    await logRun(runId, { status: "success", finished_at: new Date().toISOString(), summary });

    return new Response(
      JSON.stringify({ ok: true, summary, results }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in bill_update:", error);
    await logRun(runId, { status: "error", finished_at: new Date().toISOString(), error: error?.message || String(error) });
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});

