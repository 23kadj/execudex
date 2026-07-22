/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
/** Higher RPM for https://r.jina.ai Reader (Votesmart often blocks direct Edge fetches / bare Tavily extract). */
const JINA_API_KEY = Deno.env.get("JINA_API_KEY") || "";

/** Timeouts */
const SEARCH_TIMEOUT_MS = 10_000;
const EXTRACT_TIMEOUT_MS = 15_000;
const MISTRAL_TIMEOUT_MS = 20_000;

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

function isVoteSmartDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "votesmart.org" || host.endsWith(".votesmart.org");
}

function nameToSlug(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Count how many name tokens ("mark", "kelly") appear as whole segments of a URL's name slug */
function nameTokenMatchCount(nameSlug: string, fullName: string): number {
  const slugTokens = new Set(nameSlug.split("-").filter(Boolean));
  const nameTokens = nameToSlug(fullName).split("-").filter((t) => t.length > 1);
  return nameTokens.filter((t) => slugTokens.has(t)).length;
}

/**
 * Expected: /candidate/key-votes/{candidateId}/{nameSlug}
 * A lastName-substring check let e.g. "chris-kelly" or "kelly-ayotte" pass for
 * "Mark Kelly" (both contain "kelly" as a substring) — require the URL's name
 * slug to match at least 2 of the person's name tokens as whole words instead
 * (or all tokens, for single-token names), so common surnames don't cause a
 * different politician's voting record to be attached.
 */
function isKeyVotesCandidateUrl(url: string, fullName: string): boolean {
  try {
    const urlObj = new URL(url);
    if (!isVoteSmartDomain(urlObj.hostname)) return false;
    const segments = urlObj.pathname.toLowerCase().split("/").filter(Boolean);
    if (segments.length < 4) return false;
    if (segments[0] !== "candidate" || segments[1] !== "key-votes") return false;
    if (!/^\d+$/.test(segments[2])) return false;
    if (!segments[3]) return false;
    const nameTokens = nameToSlug(fullName).split("-").filter((t) => t.length > 1);
    const minMatches = Math.min(2, nameTokens.length);
    return nameTokenMatchCount(segments[3], fullName) >= minMatches;
  } catch {
    return false;
  }
}

function normalizeBillNumber(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function extractBillUrls(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const billLinkPattern = /\[([A-Z]+(?:\s+[A-Z]+){0,3}\s*\d+)\]\((https?:\/\/votesmart\.org\/bill\/[^\)\s]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = billLinkPattern.exec(content)) !== null) {
    const billNumber = (match[1] || "").trim();
    const link = (match[2] || "").trim();
    if (!billNumber || !link) continue;
    const key = normalizeBillNumber(billNumber);
    if (!map.has(key)) {
      map.set(key, link);
    }
  }
  return map;
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
  // Distinguishes an authenticated Jina call from the unauthenticated/cached path.
  // Unauthenticated baseline (measured directly against r.jina.ai): x-ratelimit-limit
  // is "20, 20;w=60" and the body carries a "cached snapshot" warning. A valid key
  // should report a materially higher limit and no warning. A 401 here means the
  // configured JINA_API_KEY is dead; a short key_len means it was truncated.
  console.log("[RECORDS_UPDATE] jina", JSON.stringify({
    authed: !!JINA_API_KEY.trim(),
    key_len: JINA_API_KEY.trim().length,
    status: res?.status ?? null,
    rate_limit: res?.headers.get("x-ratelimit-limit") ?? null,
    rate_remaining: res?.headers.get("x-ratelimit-remaining") ?? null,
  }));
  if (!res || !res.ok) {
    throw new Error(`Jina reader HTTP ${res?.status}`);
  }
  const text = (await res.text()).trim();
  console.log("[RECORDS_UPDATE] jina body", JSON.stringify({
    chars: text.length,
    cached: text.includes("cached snapshot"),
  }));
  if (text.length < 400) {
    throw new Error(`Jina reader body too short (${text.length} chars)`);
  }
  return text;
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

/**
 * Bare Tavily extract on votesmart.org fails/returns empty often enough that
 * records_open (which scrapes the same domain for individual bill pages)
 * already had to build this fallback chain — records_update never had it and
 * would give up entirely the moment Tavily came back empty, even when the
 * candidate URL itself was correct.
 */
async function extractWithFallbacks(url: string): Promise<string> {
  const errors: string[] = [];

  try {
    const viaTavily = await tavilyExtract(url);
    if (viaTavily.trim().length > 0) return viaTavily;
    errors.push("tavily: empty");
  } catch (e) {
    errors.push(`tavily: ${e}`);
  }

  try {
    return await fetchViaJinaReader(url);
  } catch (e) {
    errors.push(`jina: ${e}`);
  }

  try {
    return await fetchVoteSmartPageAsFallbackText(url);
  } catch (e) {
    errors.push(`direct: ${e}`);
  }

  throw new Error(errors.join(" | "));
}

/** ========================== MISTRAL ========================== */
async function mistralJSON(system: string, user: string, max_tokens = 2000): Promise<any> {
  const r = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      temperature: 0.0,
      response_format: { type: "json_object" },
      max_tokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    timeoutMs: MISTRAL_TIMEOUT_MS,
  });
  if (!r || !r.ok) throw new Error(`Mistral error ${r?.status}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

/** ========================== PARSING ========================== */
interface VotingRecord {
  date: string; // MM/DD/YYYY, or "" if not present
  legislationName: string;
  billNumber: string; // e.g., "HR 4405", "AB 2405", "SB 1102", "S J Res 63"
  outcome: string; // "signs", "vetoes", "line item vetoes", "votes yes", "votes no"
  billUrl?: string;
}

const VALID_OUTCOMES = new Set(["signs", "vetoes", "line item vetoes", "votes yes", "votes no"]);

// VoteSmart key-votes pages list dozens of entries with formatting that varies
// (governor sign/veto tables vs. legislator yes/no tables, different Tavily
// markdown conversions) — a hand-rolled regex cascade was too brittle against
// that variance and would silently return zero records on any format drift.
// Chunk + overlap so entries spanning a chunk boundary aren't dropped; dedupe
// afterward on (date, legislation name, bill number).
const CHUNK_SIZE = 25_000;
const CHUNK_OVERLAP = 1_000;

function chunkContent(content: string): string[] {
  if (content.length <= CHUNK_SIZE) return [content];
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(content.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

async function extractVotingRecordsFromChunk(chunk: string): Promise<VotingRecord[]> {
  const sys = `You extract voting-record entries from VoteSmart candidate key-votes page content (markdown, possibly messy). Return ONLY JSON. Never invent data not present in the text.`;
  const usr = `
Extract every distinct voting-record entry visible in this page content. Each entry is either a governor sign/veto action or a legislator yes/no vote on a specific bill.

CONTENT:
"""${chunk}"""

Return strictly as JSON:
{
  "records": [
    {
      "date": "<MM/DD/YYYY, or null if not shown>",
      "legislation_name": "<short legislation name/title, no markdown link syntax>",
      "bill_number": "<bill number as shown, e.g. 'HR 1234', 'SB 567', 'S J Res 63', or null>",
      "outcome": "<one of exactly: signs | vetoes | line item vetoes | votes yes | votes no>"
    }
  ]
}

Rules:
- Only include entries that have BOTH a bill_number and a valid outcome — skip anything incomplete or ambiguous.
- Do not invent dates, bill numbers, or outcomes not present in the content.
- Ignore navigation, footer, login, and image/link boilerplate.
- If nothing qualifies, return {"records": []}.
`.trim();

  try {
    const j = await mistralJSON(sys, usr, 2000);
    const raw = Array.isArray(j?.records) ? j.records : [];
    const out: VotingRecord[] = [];
    for (const r of raw) {
      const legislationName = String(r?.legislation_name || "").trim();
      const billNumber = String(r?.bill_number || "").trim();
      const outcome = String(r?.outcome || "").trim().toLowerCase();
      if (!legislationName || !billNumber || !VALID_OUTCOMES.has(outcome)) continue;
      out.push({
        date: String(r?.date || "").trim(),
        legislationName,
        billNumber,
        outcome,
      });
    }
    return out;
  } catch (e) {
    console.error("[RECORDS_UPDATE] Mistral extraction failed for chunk:", e);
    return [];
  }
}

/** Extract voting records from scraped markdown content via Mistral (chunked, deduped) */
async function extractVotingRecords(content: string): Promise<VotingRecord[]> {
  const chunks = chunkContent(content);
  console.log(`[RECORDS_UPDATE] Extracting from ${chunks.length} chunk(s) via Mistral`);

  const chunkResults = await Promise.all(chunks.map((c) => extractVotingRecordsFromChunk(c)));

  const seen = new Set<string>();
  const records: VotingRecord[] = [];
  for (const chunkRecords of chunkResults) {
    for (const r of chunkRecords) {
      const key = `${r.date}|${r.legislationName}|${r.billNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(r);
    }
  }

  console.log(`[RECORDS_UPDATE] Extracted ${records.length} unique voting records via Mistral`);
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

    // De-duplicate while preserving order
    searchUrls = [...new Set(searchUrls)];

    let validUrls = searchUrls.filter((url) => isKeyVotesCandidateUrl(url, politicianName));

    // If strict filtering found nothing, try lenient matching on key-votes pages in votesmart domains —
    // still require at least one name-token match so this doesn't attach a
    // completely unrelated politician's voting record (previously had no name
    // check at all here).
    if (validUrls.length === 0) {
      console.log(`[RECORDS_UPDATE] Strict filtering found no URLs, trying lenient matching...`);
      const lenientUrls = searchUrls.filter((url) => {
        try {
          const u = new URL(url);
          if (!isVoteSmartDomain(u.hostname) || !u.pathname.toLowerCase().includes("/key-votes/")) return false;
          const segments = u.pathname.toLowerCase().split("/").filter(Boolean);
          const nameSlug = segments[segments.length - 1] || "";
          return nameTokenMatchCount(nameSlug, politicianName) >= 1;
        } catch {
          return false;
        }
      });

      if (lenientUrls.length > 0) {
        console.log(`[RECORDS_UPDATE] Lenient matching found ${lenientUrls.length} URLs:`, lenientUrls);
        validUrls = [...new Set(lenientUrls)];
      } else {
        console.log(`[RECORDS_UPDATE] No valid URLs found (must contain '/candidate/key-votes/')`);
        console.log(`[RECORDS_UPDATE] Searched URLs were:`, searchUrls);
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
    
    // Build ordered extraction candidates (most likely to succeed first).
    const sortedValidUrls = [...validUrls].sort((a, b) => {
      const as = a.toLowerCase().includes("justfacts.votesmart.org") ? 1 : 0;
      const bs = b.toLowerCase().includes("justfacts.votesmart.org") ? 1 : 0;
      return bs - as;
    });

    // Synthesize the canonical root key-votes URL from the resolved candidate
    // ID + slug and always try it first. Search results often surface only a
    // category-specific sub-page (e.g. ".../117248/greg-steube/2/abortion"),
    // which covers far fewer votes than the root page and can fail to extract
    // on its own even when the candidate itself was correctly identified.
    let constructedRootCandidates: string[] = [];
    try {
      const segs = new URL(validUrls[0]).pathname.split("/").filter(Boolean);
      const candidateId = segs[2];
      const candidateSlug = segs[3];
      if (candidateId && candidateSlug) {
        constructedRootCandidates = [
          `https://votesmart.org/candidate/key-votes/${candidateId}/${candidateSlug}`,
          `https://justfacts.votesmart.org/candidate/key-votes/${candidateId}/${candidateSlug}`,
        ];
      }
    } catch {}

    const extractionCandidates = [...new Set([
      ...constructedRootCandidates,
      targetUrl,
      ...sortedValidUrls.filter((u) => u !== targetUrl),
    ])];

    console.log(`[RECORDS_UPDATE] Extraction candidates:`, extractionCandidates);

    // Extract content from candidate URLs until one succeeds.
    let scrapedContent: string = "";
    let lastExtractErr: unknown = null;
    const allExtractErrors: Record<string, string> = {};
    for (const candidateUrl of extractionCandidates) {
      try {
        console.log(`[RECORDS_UPDATE] Extracting from: ${candidateUrl}`);
        const candidateContent = await extractWithFallbacks(candidateUrl);
        if (!candidateContent || candidateContent.trim().length === 0) {
          console.log(`[RECORDS_UPDATE] Empty content from: ${candidateUrl}`);
          continue;
        }
        scrapedContent = candidateContent;
        targetUrl = candidateUrl;
        break;
      } catch (extractErr) {
        lastExtractErr = extractErr;
        allExtractErrors[candidateUrl] = String(extractErr);
        console.error(`[RECORDS_UPDATE] Extract error for ${candidateUrl}:`, extractErr);
      }
    }

    if (!scrapedContent || scrapedContent.trim().length === 0) {
      if (lastExtractErr) {
        console.error(`[RECORDS_UPDATE] All extraction attempts failed. Last error:`, lastExtractErr);
      } else {
        console.log(`[RECORDS_UPDATE] No content extracted from any candidate URL`);
      }
      await supabase
        .from("ppl_index")
        .update({ records: "fail" })
        .eq("id", politicianId);
      return json(200, {
        inserted: 0,
        message: "Extract failed for all candidate URLs",
        success: false,
        debug_extraction_candidates: extractionCandidates,
        debug_last_error: lastExtractErr ? String(lastExtractErr) : null,
        debug_all_errors: allExtractErrors,
      });
    }

    // Parse voting records from scraped content
    // Log a sample of the content for debugging (first 2000 chars)
    const contentSample = scrapedContent.substring(0, 2000);
    console.log(`[RECORDS_UPDATE] Content sample (first 2000 chars):\n${contentSample}`);
    const votingRecords = await extractVotingRecords(scrapedContent);
    const billUrlByNumber = extractBillUrls(scrapedContent);
    for (const record of votingRecords) {
      const normalizedBill = normalizeBillNumber(record.billNumber);
      record.billUrl = billUrlByNumber.get(normalizedBill);
    }
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
        link: record.billUrl ?? null,
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

