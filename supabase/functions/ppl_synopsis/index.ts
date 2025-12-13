/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== INDEXED STATUS MANAGEMENT ========================== */

/**
 * Check if a politician profile is properly indexed and update the indexed column
 * A profile is considered indexed when:
 * - It has a row in ppl_profiles
 * - It has a value in ppl_profiles.synopsis
 * - It has a value for "updated_at" in ppl_profiles
 */
async function updatePoliticianIndexedStatus(id: number): Promise<void> {
  try {
    const { data: profileData, error } = await supabase
      .from("ppl_profiles")
      .select("synopsis, updated_at")
      .eq("index_id", id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn(`Error checking ppl_profiles for id ${id}:`, error);
      return;
    }

    const isIndexed = !!(
      profileData && 
      profileData.synopsis && 
      profileData.updated_at
    );

    const { error: updateError } = await supabase
      .from("ppl_index")
      .update({ indexed: isIndexed })
      .eq("id", id);

    if (updateError) {
      console.warn(`Failed to update indexed status for ppl_index id ${id}:`, updateError);
    } else {
      console.log(`Updated indexed status for ppl_index id ${id}: ${isIndexed}`);
    }
  } catch (error) {
    console.error(`Error in updatePoliticianIndexedStatus for id ${id}:`, error);
  }
}

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!; // NEW
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";

/** Use mistral-small by default (as requested). */
const MISTRAL_MODEL = Deno.env.get("MISTRAL_MODEL") || "mistral-small-latest";

/** Lower corpus cap to 120k (as requested). */
const MAX_CORPUS_LEN = 200_000; // safety cap (applies to final combined corpus)

const WEB_PART_LEN = 110_000;   // per-link extract cap
const WIKI_NAME_MATCH = "wikipedia"; // filename contains (case-insensitive)
const DOWNLOAD_CONCURRENCY = 6; // tune for your edge limits
const DOWNLOAD_TIMEOUT_MS = 4_000; // per-object soft timeout (reduced from 10_000)
const DOWNLOAD_RETRIES = 1; // total tries per object (reduced from 2)
const WEB_MAX_LINKS = 3; // take first 3 allowed-domain links (unchanged)

/** NEW: limit wiki files used to at most 2 (as requested). */
const WIKI_MAX_FILES = 2;

/** Allowed domains (same list used in ppl_round2; excludes whitehouse.gov) */
const ALLOWED_DOMAINS = [
  // Core domains
  "ballotpedia.org","votesmart.org","govtrack.us","c-span.org","propublica.org",
  "opensecrets.org","followthemoney.org","openstates.org","factcheck.org","politifact.com",
  "pewresearch.org","gallup.com","kff.org","rand.org","crfb.org","reuters.com","apnews.com",
  "congress.gov","senate.gov","house.gov","fec.gov","gao.gov","cbo.gov","govinfo.gov",
  "federalregister.gov","ecfr.gov","eac.gov","archives.gov","usa.gov","census.gov","bls.gov",
  "bea.gov","treasury.gov","usaspending.gov","oversight.gov","loc.gov","supremecourt.gov",
  "ncsl.org","bipartisanpolicy.org","urban.org","pgpf.org","pogo.org","presidency.ucsb.edu",
  "law.cornell.edu","oyez.org","voteview.com","pbs.org","npr.org","bbc.com","thehill.com",
  "bloomberg.com","axios.com","snopes.com","afp.com","fivethirtyeight.com","yougov.com",
  "morningconsult.com","data.gov","gpo.gov","irs.gov","hhs.gov","cdc.gov","fda.gov","nih.gov",
  "eia.gov","noaa.gov","usgs.gov","dot.gov","bts.gov","ed.gov","nces.ed.gov","hud.gov","fbi.gov",
  "ojp.gov","justice.gov","dhs.gov","ssa.gov","sba.gov","sec.gov","ftc.gov","fcc.gov",
  "consumerfinance.gov","reginfo.gov","usitc.gov","uscourts.gov","federalreserve.gov",
  "stlouisfed.org","nationalacademies.org","constitutioncenter.org","courtlistener.com",
  "electproject.org","electionlab.mit.edu","ourworldindata.org","oecd.org","worldbank.org",
  "imf.org","un.org","cbc.ca","abc.net.au","dw.com","nga.org","naco.org","ncsc.org",
  "bioguide.congress.gov","usafacts.org","campaignlegal.org",
  "nap.edu","icpsr.umich.edu","ballotready.org","usmayors.org","csg.org","goodjobsfirst.org",
  // Additional domains from user request
  "bjs.ojp.gov","gsa.gov","oig.justice.gov","usda.gov","energy.gov","nhtsa.gov",
  "publicintegrity.org","nber.org","dataverse.harvard.edu","csis.org","randstatestats.org",
  "reporterslab.org","freepress.net","wsj.com","latimes.com","christianitytoday.com",
  "taxpolicycenter.org","energyinnovation.org"
] as const;

/** ========================== CLIENT ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function nowIso() { return new Date().toISOString(); }

async function readId(req: Request): Promise<number> {
  const url = new URL(req.url);
  const qId = url.searchParams.get("id");
  if (qId && /^\d+$/.test(qId)) return Number(qId);

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (typeof j?.id === "number") return j.id;
    if (typeof j?.id === "string" && /^\d+$/.test(j.id)) return Number(j.id);
  } else {
    const raw = (await req.text() || "").trim();
    if (/^\d+$/.test(raw)) return Number(raw);
  }
  throw new Error("Missing or invalid id. Provide as JSON { id }, query ?id=, or raw numeric body.");
}

const trim = (s: unknown) =>
  String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isEmpty = (s: unknown) => trim(s).length === 0;

/** prefer English-named wiki files if any; else use all wiki files */
function preferEnglish(paths: string[]): string[] {
  const enLike = paths.filter((p) =>
    /(^|[\W_])(en|eng)[\W_]*wikipedia|en\.wikipedia|wikipedia[_\-\.]en/i.test(p)
  );
  return enLike.length ? enLike : paths;
}

async function listWikiPaths(id: number): Promise<string[]> {
  const prefix = `ppl/${id}`;
  const { data, error } = await supabase.storage
    .from(WEB_BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  const files =
    (data || []).filter(
      (it) =>
        it &&
        !it.name.endsWith("/") &&
        it.name.toLowerCase().includes(WIKI_NAME_MATCH)
    ) ?? [];
  return preferEnglish(files.map((f) => `${prefix}/${f.name}`));
}

async function downloadText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(WEB_BUCKET).download(path);
  if (error) throw error;
  return await data.text();
}

/** ---- Soft timeout (does not abort underlying request) ---- */
async function withTimeout<T>(p: Promise<T>, ms: number, label = "op"): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Timeout after ${ms}ms: ${label}`)), ms)),
  ]);
}

/** ---- Tiny retry helper ---- */
async function withRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  let lastErr: any;
  for (let k = 0; k < tries; k++) {
    try { return await fn(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** ---- Bounded concurrency mapper ---- */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await mapper(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function getIndexRow(id: number) {
  const { data, error } = await supabase
    .from("ppl_index")
    .select("id, name, sub_name, gov_level, party_type, office_type, slug, state_code")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function getProfilesRow(index_id: number) {
  const { data, error } = await supabase
    .from("ppl_profiles")
    .select("id, index_id, synopsis, agenda, identity, affiliates, created_at")
    .eq("index_id", index_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** ===================== Title extraction & safety ===================== */
const GENERIC_TITLE_SET = new Set([
  "profile","page","homepage","index","main page","document","article","wiki","wikipedia","home"
]);

function isGenericTitle(s: string | null | undefined): boolean {
  const v = (s || "").toLowerCase().trim();
  return !v || v.length < 2 || GENERIC_TITLE_SET.has(v);
}

function toTitleCaseWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function titleCaseFromSlug(slug: string): string {
  // split on common separators, drop junk tokens (digits/dates/generic)
  const tokens = slug
    .split(/[\s_\-\.]+/g)
    .map(t => t.trim())
    .filter(t => t && !/^\d{1,4}$/.test(t) && !GENERIC_TITLE_SET.has(t.toLowerCase()));
  if (!tokens.length) return "";
  return tokens.map(toTitleCaseWord).join(" ").replace(/\s+/g, " ").trim();
}

/** Old path-based extractor, now smarter & safe */
function extractWikiTitleFromPath(path: string): string | null {
  try {
    const filename = path.split("/").pop() || "";
    const withoutExt = filename.replace(/\.[^.]+$/, "");
    let s = withoutExt;
    try { s = decodeURIComponent(s); } catch {}
    // Remove obvious domain/language markers around "wikipedia"
    s = s
      .replace(/en\.wikipedia(\.org)?[_\-\.\s]*/i, " ")
      .replace(/wikipedia(\.org)?[_\-\.\s]*/i, " ")
      .replace(/\s+/g, " ")
      .trim();
    const tc = titleCaseFromSlug(s);
    return tc || null;
  } catch {
    return null;
  }
}

/** Prefer title from CONTENT first (e.g., "# Joe Biden" or "Title: Joe Biden") */
function extractTitleFromContent(md: string): string | null {
  if (!md) return null;
  // Try Markdown H1
  const h1 = md.match(/^\s*#\s+(.{2,120})$/m);
  if (h1?.[1]) return h1[1].trim();
  // Try "Title:" prefix
  const tline = md.match(/^\s*Title\s*:\s*(.{2,120})$/mi);
  if (tline?.[1]) return tline[1].trim();
  return null;
}

/** Derive a safe preferred display name */
function derivePreferredName(
  wikiPaths: string[],
  wikiTexts: string[],
  idxName: string | null | undefined
): string | null {
  // 1) Any content-provided title?
  for (const text of wikiTexts) {
    const t = extractTitleFromContent(text || "");
    if (t && !isGenericTitle(t)) return t;
  }
  // 2) Path-based candidate (first usable)
  for (const p of wikiPaths) {
    const t = extractWikiTitleFromPath(p);
    if (t && !isGenericTitle(t)) return t;
  }
  // 3) Fallback to index name
  const fallback = (idxName || "").trim();
  return fallback || null;
}

/** ========================== ALLOWED DOMAIN HELPERS ========================== */
function matchAllowedDomain(u: string): string | null {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return (ALLOWED_DOMAINS as readonly string[]).includes(host) ? host : null;
  } catch { return null; }
}

/** Comprehensive domain blocking for biased/partisan content */
function isBlockedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace(/^www\./, "").toLowerCase();
    const path = urlObj.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();
    
    // Specific blocked domains
    const blockedDomains = [
      "whitehouse.gov","speaker.gov","majorityleader.gov","minorityleader.gov",
      "democrats.senate.gov","republican.senate.gov","republicans.senate.gov",
      "republicans-energycommerce.house.gov","democrats-waysandmeans.house.gov",
      "judiciary.house.gov","waysandmeans.house.gov","energycommerce.house.gov",
      "republicans-judiciary.house.gov","democrats-judiciary.house.gov",
      "republicans-oversight.house.gov","democrats-oversight.house.gov",
      "republicans-budget.house.gov","democrats-budget.house.gov",
      "republicans-foreignaffairs.house.gov","democrats-foreignaffairs.house.gov",
      "republicans-homeland.house.gov","democrats-homeland.house.gov",
      "republicans-financialservices.house.gov","democrats-financialservices.house.gov",
      "republicans-rules.house.gov","democrats-rules.house.gov",
      "republicans-education.house.gov","democrats-education.house.gov",
      "republicans-agriculture.house.gov","democrats-agriculture.house.gov",
      "republicans-smallbusiness.house.gov","democrats-smallbusiness.house.gov",
      "republicans-science.house.gov","democrats-science.house.gov",
      "republicans-transportation.house.gov","democrats-transportation.house.gov",
      "republicans-armedservices.house.gov","democrats-armedservices.house.gov",
      "republicans-veterans.house.gov","democrats-veterans.house.gov",
      "republicans-appropriations.house.gov","democrats-appropriations.house.gov",
      "republicans-naturalresources.house.gov","democrats-naturalresources.house.gov",
      "republicans-ethics.house.gov","democrats-ethics.house.gov",
      "republicans-intelligence.house.gov","democrats-intelligence.house.gov",
      "republicans-administration.house.gov","democrats-administration.house.gov",
      "democrats.org","gop.com","rnc.org","dnc.org","dscc.org","nrsc.org",
      "dccc.org","nrcc.org","dlcc.org","rga.org","dga.org","nrga.org",
      "ags.org","sos.org","republicanstudycommittee.house.gov","newdemocrats.house.gov",
      "progressives.house.gov","freedomcaucus.house.gov","congressionalprogressivecaucus.org",
      "republicanstudycommittee.com","housegop.gov","senategop.gov","senatedemocrats.gov",
      "mediamatters.org","newsbusters.org","mrc.org","americanprogress.org",
      "heritage.org","aei.org","cato.org","hoover.org","claremont.org",
      "manhattan-institute.org","rstreet.org","brookings.edu","centerforamericangreatness.org",
      "pacificresearch.org","reason.org","americanactionforum.org","americansforprosperity.org",
      "clubforgrowth.org","freedomworks.org","afpi.org","americafirstpolicy.com",
      "americafirstpolicy.org","standtogether.org","actblue.org","winred.com",
      "moveon.org","indivisible.org","aclu.org","naacp.org","colorofchange.org",
      "everytown.org","giffords.org","nra.org","nraila.org","sba-list.org",
      "sbaprolife.org","marchforlife.org","liveaction.org","familypolicyalliance.com",
      "familyresearchcouncil.org","heritageaction.com","citizensunited.org",
      "judicialwatch.org","projectveritas.com","fire.org","brennancenter.org",
      "commoncause.org","publiccitizen.org","cffp.org","mediaresearch.org",
      "fairus.org","cis.org","numbersusa.org","adl.org","jstreet.org",
      "aipac.org","ifamericansknew.org","christianvoterguide.com","catholicvote.org",
      "focusonthefamily.com","humanrightscampaign.org","glaad.org",
      "plannedparenthood.org","plannedparenthoodaction.org","ppaction.org",
      "nrlc.org","prochoiceamerica.org","democracydocket.com","lawfaremedia.org",
      "populardemocracy.org","progressivepolicy.org","thirdway.org","justfacts.com",
      "prri.org","peoplespolicyproject.org","project2025.org","pogo.org",
      "pompeo.house.gov","pelosi.house.gov","schumer.senate.gov","mcconnell.senate.gov",
      "gaetz.house.gov","aoc.house.gov","cruz.senate.gov","warren.senate.gov",
      "sanders.senate.gov","rubio.senate.gov","hawley.senate.gov","ocasio-cortez.house.gov",
      "boebert.house.gov","omar.house.gov","mtgreene.house.gov","ilhanomar.house.gov",
      "tedcruz.senate.gov","elizabethwarren.com","berniesanders.com","marcorubio.com",
      "randpaul.senate.gov","tomcotton.senate.gov","kff.org","rand.org",
      "taxfoundation.org","mercatus.org","fdd.org","americanprinciplesproject.org",
      "ppic.org","ethicsandpublicpolicy.org","capaction.org","americanprogressaction.org",
      "aclj.org","aflcio.org","seiu.org","teamster.org","afscme.org","teachforamerica.org",
      "americorps.gov","aclu.com","momsdemandaction.org","gunowners.org","saf.org",
      "firearmspolicy.org","usccb.org","sutherlandinstitute.org","catholic.com",
      "truthout.org","theintercept.com","prospect.org","americanmind.org",
      "realclearpolicy.com","realclearpolitics.com","dailykos.com","redstate.com",
      "townhall.com","nationalreview.com","thefederalist.com","washingtonexaminer.com",
      "americanthinker.com","jacobin.com","dissentmagazine.org","newrepublic.com",
      "spectator.org","americanconservative.com","foxnews.com","msnbc.com",
      "newsmax.com","oann.com","pjmedia.com","slate.com","motherjones.com",
      "breitbart.com","theepochtimes.com","thegatewaypundit.com","fivethirtyeight.com"
    ];
    
    // Check exact domain matches
    if (blockedDomains.includes(host)) return true;
    
    // Party caucus/leadership .gov patterns
    if (/^(.*\.)?democrats\.senate\.gov$/.test(host)) return true;
    if (/^(.*\.)?republican(s)?\.senate\.gov$/.test(host)) return true;
    if (/^(.*\.)?(speaker|majorityleader|minorityleader)\.gov$/.test(host)) return true;
    
    // House/Senate committee pages branded by party
    if (/^(.*\.)?[a-z-]+\.house\.gov$/.test(host) && 
        (fullUrl.includes('republicans') || fullUrl.includes('democrats'))) return true;
    
    // Member office sites (inherently partisan)
    if (/^(.*\.)?[a-z0-9-]+\.house\.gov$/.test(host)) return true;
    if (/^(.*\.)?[a-z0-9-]+\.senate\.gov$/.test(host)) return true;
    
    // Party/campaign .org patterns
    if (/^(.*\.)?((democrats|gop|rnc|dnc|dscc|nrsc|dccc|nrcc|dlcc|rga|dga))\.org$/.test(host)) return true;
    
    return false;
  } catch { return false; }
}

/** ========================== TAVILY (no storage) ========================== */
async function tavilySearchAgenda(fullName: string): Promise<string[]> {
  const payload = {
    api_key: TAVILY_API_KEY,
    query: `${fullName} agenda`,
    search_depth: "basic",
    include_domains: ALLOWED_DOMAINS as unknown as string[],
    max_results: 20 // (unchanged per request)
  };
  const r = await withTimeout(
    fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    4_000,
    "tavily_search"
  );
  if (!r.ok) throw new Error(`Tavily search error ${r.status}`);
  const j = await r.json();
  const list: Array<{ url?: string }> = j?.results || j?.data || [];
  const urls = list
    .map((x) => String(x?.url || ""))
    .filter((u) => u && !isBlockedDomain(u) && matchAllowedDomain(u))
    .slice(0, WEB_MAX_LINKS);
  return urls;
}

/** NEW: Batch extract in a single call (as requested). */
async function tavilyExtractBatch(urls: string[]): Promise<string[]> {
  if (!urls.length) return [];
  const r = await withTimeout(
    fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, urls, format: "markdown" })
    }),
    4_000,
    "tavily_extract"
  );
  if (!r.ok) throw new Error(`Tavily extract error ${r.status}`);
  const j = await r.json();
  const results: any[] = j?.results ?? [];
  return results.map((res, i) => {
    const u = urls[i] || "";
    const host = (() => { try { return new URL(u).hostname; } catch { return u; } })();
    const content =
      (typeof res?.markdown === "string" && res.markdown) ||
      (typeof res?.content === "string" && res.content) ||
      (typeof res?.raw_content === "string" && res.raw_content) ||
      "";
    const clipped = content ? (content.length > WEB_PART_LEN ? content.slice(0, WEB_PART_LEN) : content) : "";
    return clipped ? `\n[Source] ${host} — ${u}\n\n${clipped}` : "";
  });
}

/** Build ephemeral WEB CONTEXT text (no storage side effects). */
async function buildWebAgendaContext(fullName: string): Promise<{ webText: string; sources: string[] }> {
  try {
    const urls = await tavilySearchAgenda(fullName);

    // NEW: single batch extract call
    const extracts = await tavilyExtractBatch(urls);

    const usable = extracts.filter(Boolean);
    return {
      webText: usable.length ? `\n=== WEB CONTEXT (ephemeral; ${usable.length} source(s)) ===\n${usable.join("\n\n---\n")}\n` : "",
      sources: urls
    };
  } catch {
    return { webText: "", sources: [] };
  }
}

/** ========================== MISTRAL ========================== */
async function mistralJSON(system: string, user: string, max_tokens = 900) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,                // now defaults to "mistral-small-latest"
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens,                          // (unchanged per request)
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Mistral error ${r.status}`);
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

/** ========================== PROMPT ========================== */
/** NOTE: preferred_name enforces the synopsis name; ABSOLUTE BAN for "covid 19". */
function makePrompt(opts: {
  meta: {
    name?: string | null;
    sub_name?: string | null;
    gov_level?: string | null;
    party_type?: string | null;
    office_type?: string | null;
    slug?: string | null;
    state_code?: string | null;
  };
  role_mode: "official" | "candidate";
  corpus: string; // Wikipedia + optional WEB CONTEXT appended
  preferred_name?: string | null;
}) {
  const { meta, role_mode, corpus, preferred_name } = opts;

  const metaLine = [
    meta.name ? `name: ${meta.name}` : null,
    meta.sub_name ? `sub_name: ${meta.sub_name}` : null,
    meta.party_type ? `party: ${meta.party_type}` : null,
    meta.office_type ? `office_type: ${meta.office_type}` : null,
    meta.gov_level ? `gov_level: ${meta.gov_level}` : null,
    meta.state_code ? `state: ${meta.state_code}` : null,
    meta.slug ? `slug: ${meta.slug}` : null,
  ].filter(Boolean).join(" | ");

  const system = `
You are a precise political summarizer. Use ONLY the provided SOURCE text (Wikipedia plus any WEB CONTEXT provided below), with limited exceptions noted below. No outside knowledge for the agenda field.
Write in **English**, neutral third-person, concise sentences. No quotes, no citations, no parentheses.
Return STRICT JSON with keys: "synopsis", "agenda", "identity", "affiliates".
Target lengths: synopsis ~35 words; agenda ~60; identity ~40; affiliates ~40.
When facts exist, combine multiple grounded details into 2–3 sentences per field so each field approaches its target length. Do not collapse to a single short sentence just because the SOURCE is brief.
ROLE MODE is fixed: ${role_mode.toUpperCase()}.

/* NAME NORMALIZATION (CRITICAL) ----------------------------------------------
When mentioning the person's name in the SYNOPSIS, use EXACTLY this string:
${preferred_name ? `"${preferred_name}"` : "(no override provided)"}.
Do NOT expand it with middle names or legal/alternate forms, and do NOT add honorifics.
------------------------------------------------------------------------------- */

/* ABSOLUTE BAN ---------------------------------------------------------------
Never mention "COVID 19" or "COVID-19" in any field. If the SOURCE contains it,
omit or rephrase without using those strings.
------------------------------------------------------------------------------- */

/* GROUNDING & PROHIBITIONS (CRITICAL) -----------------------------------------
- For the AGENDA field, you must use ONLY the concatenated SOURCE text (Wikipedia and, if present, WEB CONTEXT extracts). Do not use prior knowledge or training data to add agenda items.
- For SYNOPSIS, IDENTITY, and AFFILIATES, you may use limited general background knowledge to add high-level, time-agnostic context when the SOURCE is sparse (for example, overall issue focus or broad reputation), but:
  - Do NOT introduce specific dates, election outcomes, or offices that are not present in the SOURCE.
  - Do NOT add temporal qualifiers like "former", "current", etc., unless that exact qualifier appears in the SOURCE adjacent to the entity.
- When multiple dated statements conflict in the SOURCE, prefer the most recent-dated statement. If WEB CONTEXT appears more recent than Wikipedia, prioritize WEB CONTEXT for synopsis/agenda content.
- For affiliated politicians, use exact full names as given in SOURCE. Do NOT append status labels unless explicitly present.
------------------------------------------------------------------------------- `
  .trim();

  const user = `
KNOWN META (hints only): ${metaLine || "—"}

ROLE BRANCH
- OFFICIAL:
  - synopsis: Sentences 1–2 = name, party, office, most known/notable; sentence 3 = 1–2 key agenda items + notable prior roles (favor most recent from WEB CONTEXT if present or clearly grounded general knowledge). Keep all claims consistent with SOURCE.
  - agenda: Sentences 1–2 = what they claim to run on + what they've actually implemented (prefer recent items; WEB CONTEXT can be used). Sentences 3–4 = critics/media/voters: specific negatives AND positives (only if supported in SOURCE; no prior knowledge).
- CANDIDATE:
  - synopsis: Sentences 1–2 = name, what they're most known for; include party & office sought if stated. Sentence 3 = what makes them interesting as a candidate (favor recent items grounded in SOURCE or, if sparse, high-level general knowledge that does not depend on specific dates).
  - agenda: Sentences 1–4 = what they’re running on, what they claim they'll implement, and notable past items that support those claims (favor recency; WEB CONTEXT can be used; do not use training-data-only knowledge).

IDENTITY (~40 words, everyone):
- prior political/career roles, brief bio touchpoints, notable statements/positions if in the text. When SOURCE is sparse, you may use limited general background knowledge to describe broad career trajectory or themes, but never add specific dated offices or election outcomes that are not present in SOURCE.

AFFILIATES (~40 words, everyone):
- associated businesses/organizations, donors if named, notable political connections, and role within party (recognizability/influence). If the Wikipedia page does not specify these details, general use of training data and prior knowledge is allowed for this category and for SYNOPSIS and IDENTITY, but only for high-level associations (organizations, notable donors, political connections, etc.). Either way, never state the political office of their connections or time-specific roles when they do not appear in the SOURCE, to avoid stating someone as former or current when it does not match with real time data. 

STRICT HANDLING RULES (apply to ALL sections):
- For AGENDA: use only facts found in the SOURCE text; do not invent or fill gaps from training data.
- For SYNOPSIS, IDENTITY, and AFFILIATES: you may add limited general background knowledge when SOURCE is sparse, but never invent precise dates, offices, or election outcomes, and keep claims broad and time-agnostic.
- When mentioning politicians by name, write the name exactly as in the text; do not add "former/current" unless explicitly present.
- If temporal status is unclear or unstated, omit temporal qualifiers and default to the plain title/name only.

SOURCE (Wikipedia + optional WEB CONTEXT; English output only):
"""${corpus}"""
`.trim();

  return { system, user };
}

/** ========================== HANDLER ========================== */
function stripCovid19(s: string): string {
  return s.replace(/covid[\s-]*19/gi, "").replace(/\s{2,}/g, " ").trim();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });
    const id = await readId(req);

    // 1) Load index row (authoritative role branch)
    const idx = await getIndexRow(id);
    const role_mode: "official" | "candidate" =
      (idx.office_type || "").toLowerCase() === "candidate" ? "candidate" : "official";

    // 1.5) Fast path: if profile already has all fields populated, skip heavy generation
    const existingProf = await getProfilesRow(id);
    if (
      existingProf &&
      !isEmpty(existingProf.synopsis) &&
      !isEmpty(existingProf.agenda) &&
      !isEmpty(existingProf.identity) &&
      !isEmpty(existingProf.affiliates)
    ) {
      await updatePoliticianIndexedStatus(id);
      return json(409, {
        index_id: id,
        error: "Nothing to fill; all target fields already populated.",
        role_mode,
        wiki_files_checked: [],
        web_links_used: [],
        preferred_name: idx.name,
        name_overwrite: null,
      });
    }

    // 2) Find Wikipedia files
    const wikiPaths = await listWikiPaths(id);
    let wikiCorpus = "";
    let preferred_name = idx.name;

    if (!wikiPaths.length) {
      console.warn(`No Wikipedia files found for profile ${id}, using "No Data" for all fields`);
    } else {
      // 3) Download & build WIKIPEDIA corpus (limit to at most 2 files; retain existing timeout/retry)
      const selected = wikiPaths.slice(0, WIKI_MAX_FILES);
      const texts = await mapLimit(selected, Math.min(DOWNLOAD_CONCURRENCY, selected.length), async (p) => {
        try {
          return await withRetry(
            () => withTimeout(downloadText(p), DOWNLOAD_TIMEOUT_MS, `download ${p}`),
            DOWNLOAD_RETRIES
          );
        } catch (e) {
          console.warn("download failed:", p, e);
          return ""; // keep shape; we'll filter empties
        }
      });

      wikiCorpus = trim(texts.filter(Boolean).join("\n\n---\n\n"));
      
      if (!wikiCorpus) {
        console.warn(`Wikipedia files were empty for profile ${id}, using "No Data" for all fields`);
      } else {
        // 4) Derive a SAFE preferred display name (content > path > idx.name)
        preferred_name = derivePreferredName(selected, texts, idx.name);
      }
    }

    // 5) Ephemeral web search/extract for "<name> agenda" on allowed domains (first 3 links)
    let webContext = "";
    let webSources: string[] = [];
    if (wikiCorpus) {
      try {
        const { webText, sources } = await buildWebAgendaContext(String(idx.name || "").trim());
        webContext = webText;
        webSources = sources;
      } catch (e) {
        console.warn("WEB CONTEXT build failed:", e);
      }
    }

    // 6) Combine corpora (Wikipedia first, then WEB CONTEXT), then cap final size
    let combined = wikiCorpus;
    if (webContext) combined = `${wikiCorpus}\n\n${webContext}`;
    if (combined.length > MAX_CORPUS_LEN) combined = combined.slice(0, MAX_CORPUS_LEN);

    // 7) Generate fields with Mistral (English only; branch fixed by office_type) or use "No Data"
    let generated: { synopsis: string; agenda: string; identity: string; affiliates: string };
    
    if (!combined) {
      // No data available, use "No Data" for all fields
      generated = {
        synopsis: "No Data",
        agenda: "No Data", 
        identity: "No Data",
        affiliates: "No Data",
      };
    } else {
      const { system, user } = makePrompt({ meta: idx, role_mode, corpus: combined, preferred_name });
      const out = await mistralJSON(system, user); // max_tokens unchanged

      // 8) Collect + sanitize outputs (ABSOLUTE BAN enforcement)
      generated = {
        synopsis: stripCovid19(trim(out?.synopsis || "")),
        agenda: stripCovid19(trim(out?.agenda || "")),
        identity: stripCovid19(trim(out?.identity || "")),
        affiliates: stripCovid19(trim(out?.affiliates || "")),
      };
    }

    // 9) Optionally overwrite ppl_index.name — only if preferred_name is non-generic & differs
    let name_overwrite: null | { from: string; to: string; updated: boolean; error?: string } = null;
    try {
      const currentName = trim(idx.name || "");
      if (
        preferred_name &&
        !isGenericTitle(preferred_name) &&
        currentName &&
        currentName.toLowerCase() !== preferred_name.toLowerCase()
      ) {
        const { error: updErr } = await supabase
          .from("ppl_index")
          .update({ name: preferred_name })
          .eq("id", id);
        name_overwrite = {
          from: currentName,
          to: preferred_name,
          updated: !updErr,
          ...(updErr ? { error: String(updErr.message || updErr) } : {})
        };
      }
    } catch (e: any) {
      name_overwrite = {
        from: trim(idx.name || ""),
        to: preferred_name || "",
        updated: false,
        error: String(e?.message || e)
      };
    }

    // 10) Read existing profile row
    const prof = existingProf;

    // 11) Insert (if missing) or patch empties only
    const wrote: string[] = [];
    if (!prof) {
      const insertPayload: Record<string, any> = {
        index_id: id,
        created_at: nowIso(),
        synopsis: generated.synopsis,
        agenda: generated.agenda,
        identity: generated.identity,
        affiliates: generated.affiliates,
      };
      const { error: insErr } = await supabase.from("ppl_profiles").insert(insertPayload).single();
      if (insErr) throw insErr;

      // Update indexed status after successful profile creation (unchanged)
      await updatePoliticianIndexedStatus(id);

      for (const k of ["synopsis", "agenda", "identity", "affiliates"] as const) {
        if (!isEmpty(insertPayload[k])) wrote.push(k);
      }

      return json(200, {
        index_id: id,
        action: "inserted",
        wrote,
        role_mode,
        wiki_files_used: wikiPaths,
        web_links_used: webSources,
        preferred_name,
        name_overwrite,
        preview: insertPayload,
        note: !combined ? "No source data available - used 'No Data' for all fields" : undefined,
      });
    } else {
      const patch: Record<string, string> = {};
      for (const k of ["synopsis", "agenda", "identity", "affiliates"] as const) {
        if (!isEmpty(generated[k])) {
          patch[k] = generated[k];
          wrote.push(k);
        }
      }

      if (!wrote.length) {
        return json(409, {
          index_id: id,
          error: "Nothing to fill; all target fields already populated.",
          role_mode,
          wiki_files_checked: wikiPaths,
          web_links_used: webSources,
          preferred_name,
          name_overwrite,
        });
      }

      const { error: updErr } = await supabase.from("ppl_profiles").update(patch).eq("index_id", id);
      if (updErr) throw updErr;

      // Update indexed status after successful profile update (unchanged)
      await updatePoliticianIndexedStatus(id);

      return json(200, {
        index_id: id,
        action: "patched_empty_fields",
        wrote,
        role_mode,
        wiki_files_used: wikiPaths,
        web_links_used: webSources,
        preferred_name,
        name_overwrite,
        preview: patch,
        note: !combined ? "No source data available - used 'No Data' for all fields" : undefined,
      });
    }
  } catch (e: any) {
    console.error(e);
    return json(500, { error: String(e?.message || e || "unknown error") });
  }
});
  