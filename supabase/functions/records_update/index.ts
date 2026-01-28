/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;

/** Timeouts */
const SEARCH_TIMEOUT_MS = 10_000;
const EXTRACT_TIMEOUT_MS = 15_000;

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Clean title by removing markdown link syntax
 * Examples:
 *   "Title](https://link.com)" -> "Title"
 *   "[Title](https://link.com)" -> "Title"
 *   "Title](https://link.com#anchor)" -> "Title"
 */
function cleanTitle(title: string): string {
  if (!title) return "";
  
  let cleaned = title;
  
  // Remove markdown link syntax: text](url) or [text](url)
  // This handles both cases: with or without opening bracket
  // Pattern: capture text before ](url) and replace with just the text
  cleaned = cleaned.replace(/([^\]]+)\]\([^\)]+\)/g, "$1");
  
  // Also handle full markdown links: [text](url)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  
  // Remove any remaining markdown link fragments (just in case)
  cleaned = cleaned.replace(/\]\([^\)]+\)/g, "");
  
  // Remove any trailing URLs that might be left
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
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

/** ========================== PARSING ========================== */
interface VotingRecord {
  date: string; // MM/DD/YYYY
  legislationName: string;
  billNumber: string; // e.g., "HR 4405", "AB 2405", "SB 1102", "S J Res 63"
  outcome: string; // "signs", "vetoes", "line item vetoes", "votes yes", "votes no"
}

/**
 * Extract voting records from scraped markdown content
 * Pattern: ##### date, ##### legislation name, ##### outcome, table with bill number
 */
function extractVotingRecords(content: string): VotingRecord[] {
  const records: VotingRecord[] = [];
  
  // Filter out common junk patterns (navigation, images, etc.)
  const junkPatterns = [
    /!\[.*?\]\(.*?\)/g, // Markdown images
    /## Navigation.*?## /s, // Navigation sections
    /All content Ac \d{4}.*$/s, // Footer text
    /Log in.*$/s, // Login sections
    /Responsive image.*$/s, // Image references
    /Legislative demographic data.*$/s, // Footer text
    /Mobile Messaging Terms.*$/s, // Footer text
    /Our Mission.*?## /s, // Mission sections
  ];
  
  let cleanedContent = content;
  for (const pattern of junkPatterns) {
    cleanedContent = cleanedContent.replace(pattern, "");
  }
  
  // Log a sample of cleaned content for debugging
  const cleanedSample = cleanedContent.substring(0, 3000);
  console.log(`[RECORDS_UPDATE] Cleaned content sample (first 3000 chars):\n${cleanedSample}`);
  
  // Try multiple patterns to handle different markdown formats from Tavily
  
  // Pattern 1: Strict format with ##### headings (original pattern)
  // ##### MM/DD/YYYY \n\n ##### Legislation Name \n\n ##### Sign/Veto \n\n ... table with Bill No. [AB 1234]
  const pattern1 = /#####\s*(\d{2}\/\d{2}\/\d{4})\s*\n\n#####\s*([^\n]+)\s*\n\n#####\s*(Sign|Veto|Line Item Veto)\s*\n\n(?:.*?\n)*?\|[^\|]*Bill No\.\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?\s*\d+)\]/gis;
  
  // Pattern 2: More flexible - allows single newline or double newline between headings
  const pattern2 = /#####\s*(\d{2}\/\d{2}\/\d{4})\s*\n+#####\s*([^\n]+?)\s*\n+#####\s*(Sign|Veto|Line Item Veto)\s*\n+.*?(?:Bill No\.|Bill)\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?\s*\d+)\]/gis;
  
  // Pattern 3: Even more flexible - allows different heading levels (###, ####, #####)
  const pattern3 = /#{3,5}\s*(\d{2}\/\d{2}\/\d{4})\s*\n+#{3,5}\s*([^\n]+?)\s*\n+#{3,5}\s*(Sign|Veto|Line Item Veto)\s*\n+.*?(?:Bill No\.|Bill)\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?\s*\d+)\]/gis;
  
  // Pattern 4: Very flexible - looks for date, legislation name, outcome, and bill number anywhere in proximity
  const pattern4 = /(\d{2}\/\d{2}\/\d{4})\s*\n+.*?#{3,5}\s*([^\n]+?)\s*\n+.*?#{3,5}\s*(Sign|Veto|Line Item Veto)\s*\n+.*?(?:Bill No\.|Bill)\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?\s*\d+)\]/gis;
  
  const patterns = [pattern1, pattern2, pattern3, pattern4];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    let match;
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    
    console.log(`[RECORDS_UPDATE] Trying pattern ${i + 1}`);
    
    while ((match = pattern.exec(cleanedContent)) !== null) {
      const date = match[1]?.trim();
      const legislationName = match[2]?.trim();
      const outcomeRaw = match[3]?.trim().toLowerCase();
      const billNumber = match[4]?.trim();
      
      if (!date || !legislationName || !outcomeRaw || !billNumber) {
        continue;
      }
      
      // Normalize outcome to "signs", "vetoes", or "line item vetoes"
      let outcome: string;
      if (outcomeRaw.includes("sign")) {
        outcome = "signs";
      } else if (outcomeRaw.includes("line item")) {
        outcome = "line item vetoes";
      } else {
        outcome = "vetoes";
      }
      
      // Check if this record already exists in our results
      const exists = records.some(r => 
        r.date === date && 
        r.legislationName === legislationName && 
        r.billNumber === billNumber
      );
      
      if (!exists && legislationName && billNumber) {
        records.push({
          date,
          legislationName,
          billNumber,
          outcome,
        });
      }
    }
    
    // If we found records with this pattern, don't try the rest
    if (records.length > 0) {
      console.log(`[RECORDS_UPDATE] Pattern ${i + 1} succeeded with ${records.length} records`);
      break;
    }
  }
  
  // If still no records, try Senator/Representative voting patterns (Yes/No votes)
  if (records.length === 0) {
    console.log(`[RECORDS_UPDATE] Trying Senator/Representative voting patterns`);
    
    // Pattern for Senator format: ##### Date \n\n ##### Legislation Name \n\n ##### Yes/No \n\n ... table with Bill No.
    // Bill number pattern: matches "H.R. 1234", "S 567", "S J Res 63", "H.Con.Res. 45", etc.
    const billNumberPattern = /\[([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]/;
    
    const senatorPattern1 = /#####\s*(\d{2}\/\d{2}\/\d{4})\s*\n+#####\s*([^\n]+?)\s*\n+#####\s*(Yes|No)\s*\n+.*?(?:Bill No\.|Bill)\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]/gis;
    
    // More flexible senator pattern
    const senatorPattern2 = /#{3,5}\s*(\d{2}\/\d{2}\/\d{4})\s*\n+#{3,5}\s*([^\n]+?)\s*\n+#{3,5}\s*(Yes|No)\s*\n+.*?(?:Bill No\.|Bill)\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]/gis;
    
    // Pattern that looks for date, legislation name, vote, and bill number in table
    const senatorPattern3 = /(\d{2}\/\d{2}\/\d{4})\s*\n+.*?#{3,5}\s*([^\n]+?)\s*\n+.*?#{3,5}\s*(Yes|No)\s*\n+.*?Bill No\.\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]/gis;
    
    // Even more flexible: find bill number anywhere near date and vote
    const senatorPattern4 = /(\d{2}\/\d{2}\/\d{4})\s*\n+.*?#{3,5}\s*([^\n]+?)\s*\n+.*?#{3,5}\s*(Yes|No)\s*[\s\S]{0,500}?Bill No\.\s*\|[^\|]*\[([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]/gis;
    
    // Pattern for list format (no #### headings): Date \n Name \n Yes/No \n Table with Bill No.
    const senatorPattern5 = /(\d{2}\/\d{2}\/\d{4})\s*\n+([^\n]+(?:[^\n]+\n[^\n]+)?)\s*\n+(Yes|No)\s*\n+.*?Bill No\.\s*\|[^\|]*\s*([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)/gis;
    
    // Even more flexible list format: looks for date, name, vote, then bill number in nearby table
    const senatorPattern6 = /(\d{2}\/\d{2}\/\d{4})\s*\n+([A-Z][^\n]{10,200}?)\s*\n+(Yes|No)\s*[\s\S]{0,800}?Bill No\.\s*\|[^\|]*\s*([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)/gis;
    
    // Table-based pattern: Date on line, then name, then Yes/No, then table row with Bill No.
    // This handles the format where each vote is a list item with embedded table
    // Bill number can be in brackets [HR 6938] or plain text HR 6938
    const senatorPattern7 = /(\d{2}\/\d{2}\/\d{4})\s*\n([^\n]{15,300}?)\s*\n\s*(Yes|No)\s*\n.*?Bill No\.\s*\|[^\|]*\[?([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]?/gis;
    
    // Most flexible: find date, then find closest Yes/No after legislation name, then find bill in nearby table
    // Handles both bracketed and non-bracketed bill numbers
    const senatorPattern8 = /(\d{2}\/\d{2}\/\d{4})\s*\n([^\n\d]{15,300}?)\n\s*\b(Yes|No)\b\s*\n[\s\S]{0,1000}?Bill No\.\s*\|[^\|]*\[?([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]?/gis;
    
    // Most flexible list/table pattern: date, legislation name (can span lines), vote, then bill number
    // This handles the format where date/name/vote/bill are in proximity but not necessarily in headings
    const senatorPattern9 = /(\d{2}\/\d{2}\/\d{4})\s*\n+([A-Z][\s\S]{20,400}?)\n+\s*(Yes|No)\s+[\s\S]{0,500}?Bill No\.\s*\|[^\|]*\[?([A-Z]+(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?(?:\s+[A-Z]+)?\s*\d+)\]?/gis;
    
    const senatorPatterns = [senatorPattern1, senatorPattern2, senatorPattern3, senatorPattern4, senatorPattern5, senatorPattern6, senatorPattern7, senatorPattern8, senatorPattern9];
    
    for (let i = 0; i < senatorPatterns.length; i++) {
      const pattern = senatorPatterns[i];
      pattern.lastIndex = 0;
      console.log(`[RECORDS_UPDATE] Trying senator pattern ${i + 1}`);
      
      let match;
      while ((match = pattern.exec(cleanedContent)) !== null) {
        const date = match[1]?.trim();
        const legislationName = match[2]?.trim();
        const vote = match[3]?.trim().toLowerCase();
        const billNumber = match[4]?.trim();
        
        console.log(`[RECORDS_UPDATE] Senator pattern match: date=${date}, name=${legislationName?.substring(0, 50)}, vote=${vote}, bill=${billNumber}`);
        
        if (!date || !legislationName || !vote || !billNumber) {
          console.log(`[RECORDS_UPDATE] Skipping incomplete match: date=${!!date}, name=${!!legislationName}, vote=${!!vote}, bill=${!!billNumber}`);
          continue;
        }
        
        // Normalize outcome to "votes yes" or "votes no"
        const outcome = vote === "yes" ? "votes yes" : "votes no";
        
        // Check if this record already exists
        const exists = records.some(r => 
          r.date === date && 
          r.legislationName === legislationName && 
          r.billNumber === billNumber
        );
        
        if (!exists && legislationName && billNumber) {
          records.push({
            date,
            legislationName,
            billNumber,
            outcome,
          });
          console.log(`[RECORDS_UPDATE] Added senator record: ${date} - ${billNumber} - ${outcome}`);
        }
      }
      
      if (records.length > 0) {
        console.log(`[RECORDS_UPDATE] Senator pattern ${i + 1} succeeded with ${records.length} records`);
        break;
      }
    }
  }
  
  // If still no records, try a last-resort pattern that looks for bill numbers and dates more flexibly
  if (records.length === 0) {
    console.log(`[RECORDS_UPDATE] Trying last-resort pattern`);
    // Look for patterns like: date + legislation name + outcome keywords + bill number
    const lastResortPattern = /(\d{2}\/\d{2}\/\d{4}).*?(?:Vetoed|Signed|Line Item Vetoed).*?by.*?\n+.*?#{3,5}\s*([^\n]+?)\s*\n+.*?(?:Bill No\.|Bill)\s*[:\|]\s*\[?([A-Z]+(?:\s+[A-Z]+)?\s*\d+)\]?/gis;
    
    let match;
    lastResortPattern.lastIndex = 0;
    
    while ((match = lastResortPattern.exec(cleanedContent)) !== null) {
      const date = match[1]?.trim();
      const legislationName = match[2]?.trim();
      const billNumber = match[3]?.trim().replace(/[\[\]]/g, "");
      const context = match[0]?.toLowerCase() || "";
      
      if (!date || !legislationName || !billNumber) {
        continue;
      }
      
      // Determine outcome from context
      let outcome: string;
      if (context.includes("sign")) {
        outcome = "signs";
      } else if (context.includes("line item")) {
        outcome = "line item vetoes";
      } else {
        outcome = "vetoes";
      }
      
      // Check if this record already exists
      const exists = records.some(r => 
        r.date === date && 
        r.legislationName === legislationName && 
        r.billNumber === billNumber
      );
      
      if (!exists && legislationName && billNumber) {
        records.push({
          date,
          legislationName,
          billNumber,
          outcome,
        });
      }
    }
  }
  
  return records;
}

/** ========================== MAIN HANDLER ========================== */
Deno.serve(async (req) => {
  let politicianId: number | null = null;
  
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const body = await req.json().catch(() => ({}));
    politicianId = body.id ? Number(body.id) : null;
    const politicianName = body.name ? String(body.name).trim() : null;

    if (!politicianId || !politicianName) {
      return json(400, { error: "Missing required fields: id and name" });
    }

    // Verify politician exists
    const { data: politician, error: polError } = await supabase
      .from("ppl_index")
      .select("id, name")
      .eq("id", politicianId)
      .single();

    if (polError || !politician) {
      return json(404, { error: "Politician not found" });
    }

    // Extract last name first (needed for fallback searches)
    const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v", "2nd", "3rd", "4th"]);
    const nameParts = politicianName.trim().split(/\s+/).filter(Boolean);
    let lastName = "";
    for (let i = nameParts.length - 1; i >= 0; i--) {
      const part = nameParts[i].replace(/\./g, "").toLowerCase();
      if (!SUFFIXES.has(part)) {
        lastName = part.replace(/[^a-z0-9-]/g, "");
        break;
      }
    }
    if (!lastName) {
      lastName = nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    }

    // Perform Tavily search with multiple query variations
    const searchQueries = [
      `${politicianName} voting record votesmart`,
      `${politicianName} key votes votesmart`,
      `votesmart ${politicianName} key votes`,
      `votesmart ${lastName} key votes`,
    ];
    
    let searchUrls: string[] = [];
    for (const searchQuery of searchQueries) {
      try {
        console.log(`[RECORDS_UPDATE] Searching for: ${searchQuery}`);
        const urls = await tavilySearch(searchQuery);
        searchUrls.push(...urls);
        console.log(`[RECORDS_UPDATE] Query "${searchQuery}" returned ${urls.length} URLs`);
        if (urls.length > 0) break; // Stop if we got results
      } catch (searchErr) {
        console.warn(`[RECORDS_UPDATE] Search error for "${searchQuery}":`, searchErr);
        continue;
      }
    }
    
    // Deduplicate URLs
    searchUrls = [...new Set(searchUrls)];
    console.log(`[RECORDS_UPDATE] Total unique URLs found: ${searchUrls.length}`);
    console.log(`[RECORDS_UPDATE] All URLs:`, searchUrls);
    
    if (searchUrls.length === 0) {
      console.log(`[RECORDS_UPDATE] No search results found from any query`);
      // Update records column to "fail"
      await supabase
        .from("ppl_index")
        .update({ records: "fail" })
        .eq("id", politicianId);
      return json(200, { inserted: 0, message: "No search results found", success: false });
    }

    // Filter URLs to find one that matches Vote Smart key-votes format
    // More flexible: handles /candidate/key-votes/{id}/{name} or variations
    const validUrls = searchUrls.filter(url => {
      try {
        const urlLower = url.toLowerCase();
        
        // Must contain "key-votes" and be from votesmart.org domain
        if (!urlLower.includes("key-votes") || !urlLower.includes("votesmart.org")) {
          return false;
        }
        
        // Parse URL to check path structure (strip query params and fragments)
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        
        // Split path into segments (filter out empty strings)
        const segments = pathname.split("/").filter(Boolean);
        
        // Find the index of "key-votes" segment
        const keyVotesIndex = segments.findIndex(s => s.includes("key-votes"));
        if (keyVotesIndex === -1) {
          return false;
        }
        
        // Need at least: key-votes, id, and name segments
        if (segments.length < keyVotesIndex + 3) {
          return false;
        }
        
        // Get the name segment (should be after key-votes and ID)
        const nameSegment = segments[keyVotesIndex + 2];
        if (!nameSegment) {
          return false;
        }
        
        // Check that the name segment contains the last name (more flexible matching)
        const segmentParts = nameSegment.split("-");
        const segmentLower = nameSegment.toLowerCase();
        
        // Check if last name appears in the name segment (could be at end or anywhere)
        const lastNameInSegment = segmentParts.some(part => part === lastName) || 
                                  segmentLower.includes(lastName);
        
        if (!lastNameInSegment) {
          console.log(`[RECORDS_UPDATE] Name segment '${nameSegment}' doesn't contain last name '${lastName}'`);
          return false;
        }
        
        // Verify ID segment is numeric (helps validate structure)
        const idSegment = segments[keyVotesIndex + 1];
        if (!idSegment || !/^\d+$/.test(idSegment)) {
          console.log(`[RECORDS_UPDATE] ID segment '${idSegment}' is not numeric`);
          return false;
        }
        
        console.log(`[RECORDS_UPDATE] Valid URL found: ${url} (name segment: ${nameSegment}, last name: ${lastName})`);
        return true;
      } catch (e) {
        console.warn(`[RECORDS_UPDATE] Error parsing URL ${url}:`, e);
        return false;
      }
    });
    
    // If strict filtering found nothing, try more lenient matching
    if (validUrls.length === 0) {
      console.log(`[RECORDS_UPDATE] Strict filtering found no URLs, trying lenient matching...`);
      const lenientUrls = searchUrls.filter(url => {
        try {
          const urlLower = url.toLowerCase();
          // Just check: votesmart domain + key-votes + last name somewhere
          return urlLower.includes("votesmart.org") && 
                 urlLower.includes("key-votes") && 
                 urlLower.includes(lastName);
        } catch {
          return false;
        }
      });
      
      if (lenientUrls.length > 0) {
        console.log(`[RECORDS_UPDATE] Lenient matching found ${lenientUrls.length} URLs:`, lenientUrls);
        validUrls.push(...lenientUrls);
      } else {
        console.log(`[RECORDS_UPDATE] No valid URLs found (must contain 'key-votes' and last name '${lastName}')`);
        console.log(`[RECORDS_UPDATE] Searched URLs were:`, searchUrls);
        // Update records column to "fail"
        await supabase
          .from("ppl_index")
          .update({ records: "fail" })
          .eq("id", politicianId);
        return json(200, { inserted: 0, message: "No valid voting record URL found", success: false });
      }
    }

    // Prioritize URLs: prefer main key-votes page (no category number) over category-specific pages.
    // Avoid ?sponsorships=1 — that shows sponsorships-only, not key votes, and yields 0 vote rows.
    // URL structure: /candidate/key-votes/{id}/{name} or /candidate/key-votes/{id}/{name}/{category}/{category-name}
    let targetUrl = validUrls[0];
    
    const isMainPagePath = (url: string) => {
      try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split("/").filter(Boolean);
        return pathSegments.length === 4 ||
               (pathSegments.length === 5 && !/^\d+$/.test(pathSegments[4]));
      } catch {
        return false;
      }
    };

    // Prefer main key-votes page WITHOUT sponsorships=1 (full key votes, not sponsorships-only view)
    const mainPageNoSponsorships = validUrls.find(url =>
      isMainPagePath(url) && !url.toLowerCase().includes("sponsorships=1")
    );
    const mainPageUrl = mainPageNoSponsorships ?? validUrls.find(isMainPagePath);

    if (mainPageUrl) {
      targetUrl = mainPageUrl;
      console.log(`[RECORDS_UPDATE] Found main key-votes page: ${targetUrl}`);
    } else {
      // Prefer page 1 over other pages
      const page1Url = validUrls.find(url => !url.includes("?p=") || url.includes("?p=1"));
      if (page1Url) {
        targetUrl = page1Url;
        console.log(`[RECORDS_UPDATE] Using page 1 URL: ${targetUrl}`);
      }
    }
    
    console.log(`[RECORDS_UPDATE] Selected valid URL: ${targetUrl}`);
    console.log(`[RECORDS_UPDATE] Extracting from: ${targetUrl}`);

    // Extract content from the first URL
    let scrapedContent: string = "";
    try {
      scrapedContent = await tavilyExtract(targetUrl);
      if (!scrapedContent || scrapedContent.trim().length === 0) {
        console.log(`[RECORDS_UPDATE] No content extracted`);
        // Update records column to "fail"
        await supabase
          .from("ppl_index")
          .update({ records: "fail" })
          .eq("id", politicianId);
        return json(200, { inserted: 0, message: "No content extracted", success: false });
      }
    } catch (extractErr) {
      console.error(`[RECORDS_UPDATE] Extract error:`, extractErr);
      // Update records column to "fail"
      await supabase
        .from("ppl_index")
        .update({ records: "fail" })
        .eq("id", politicianId);
      return json(200, { inserted: 0, message: "Extract failed", success: false });
    }

    // Parse voting records from scraped content
    // Log a sample of the content for debugging (first 2000 chars)
    const contentSample = scrapedContent.substring(0, 2000);
    console.log(`[RECORDS_UPDATE] Content sample (first 2000 chars):\n${contentSample}`);
    const votingRecords = extractVotingRecords(scrapedContent);
    console.log(`[RECORDS_UPDATE] Extracted ${votingRecords.length} voting records`);

    if (votingRecords.length === 0) {
      // Update records column to "fail"
      await supabase
        .from("ppl_index")
        .update({ records: "fail" })
        .eq("id", politicianId);
      return json(200, { inserted: 0, message: "No voting records found in scraped content", success: false });
    }

    // Get existing slugs to prevent duplicates
    const { data: existingCards, error: existError } = await supabase
      .from("card_index")
      .select("slug, title")
      .eq("owner_id", politicianId)
      .eq("is_ppl", true);

    if (existError) {
      console.error(`[RECORDS_UPDATE] Error fetching existing cards:`, existError);
    }

    const existingSlugs = new Set<string>((existingCards || []).map((c: any) => String(c.slug || "")));
    const existingTitles = new Set<string>((existingCards || []).map((c: any) => String(c.title || "").toLowerCase()));

    // Prepare cards to insert
    const cardsToInsert: any[] = [];
    const createdAtISO = new Date().toISOString();

    for (const record of votingRecords) {
      // Create title (legislation name) - clean any markdown link syntax
      const title = cleanTitle(record.legislationName);
      
      // Create subtext: "[politician's name] signs/vetoes [bill number]"
      const subtext = `${politicianName} ${record.outcome} ${record.billNumber}`;
      
      // Create slug from title only (since screen/category are null)
      const slug = slugify(title);
      
      // Check for duplicates
      if (existingSlugs.has(slug)) {
        console.log(`[RECORDS_UPDATE] Skipping duplicate slug: ${slug}`);
        continue;
      }
      
      if (existingTitles.has(title.toLowerCase())) {
        console.log(`[RECORDS_UPDATE] Skipping duplicate title: ${title}`);
        continue;
      }
      
      // Add to insert list
      cardsToInsert.push({
        owner_id: politicianId,
        is_ppl: true,
        title,
        subtext,
        slug,
        screen: null,
        category: null,
        score: null,
        is_media: false,
        link: null,
        web: null,
        web_id: null,
        is_active: true,
        created_at: createdAtISO,
      });
      
      // Add to existing sets to prevent within-batch duplicates
      existingSlugs.add(slug);
      existingTitles.add(title.toLowerCase());
    }

    if (cardsToInsert.length === 0) {
      // If all records were duplicates, we still consider this a success (records are available)
      await supabase
        .from("ppl_index")
        .update({ records: "available" })
        .eq("id", politicianId);
      return json(200, { inserted: 0, message: "All records were duplicates", success: true });
    }

    // Insert cards in batches
    const BATCH_SIZE = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < cardsToInsert.length; i += BATCH_SIZE) {
      const batch = cardsToInsert.slice(i, i + BATCH_SIZE);
      const { data: inserted, error: insertError } = await supabase
        .from("card_index")
        .insert(batch)
        .select("id");

      if (insertError) {
        console.error(`[RECORDS_UPDATE] Insert error for batch ${i / BATCH_SIZE + 1}:`, insertError);
        // Continue with next batch instead of failing completely
        continue;
      }

      totalInserted += inserted?.length || 0;
    }

    console.log(`[RECORDS_UPDATE] Successfully inserted ${totalInserted} cards`);

    // Update records column to "available" on success
    const { error: updateError } = await supabase
      .from("ppl_index")
      .update({ records: "available" })
      .eq("id", politicianId);

    if (updateError) {
      console.error(`[RECORDS_UPDATE] Error updating records column:`, updateError);
    }

    return json(200, {
      inserted: totalInserted,
      total_found: votingRecords.length,
      politician_id: politicianId,
      politician_name: politicianName,
      source_url: targetUrl,
      success: true,
    });

  } catch (error) {
    console.error(`[RECORDS_UPDATE] Unexpected error:`, error);
    
    // Update records column to "fail" on error (only if we have a politicianId)
    if (politicianId) {
      try {
        await supabase
          .from("ppl_index")
          .update({ records: "fail" })
          .eq("id", politicianId);
      } catch (updateErr) {
        console.error(`[RECORDS_UPDATE] Error updating records column to fail:`, updateErr);
      }
    }
    
    return json(200, { inserted: 0, error: String(error), success: false });
  }
});

