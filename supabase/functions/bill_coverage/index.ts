/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEB_BUCKET     = Deno.env.get("WEB_BUCKET") || "web";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const MISTRAL_API_KEY= Deno.env.get("MISTRAL_API_KEY")!;
const MODEL_ID       = "mistral-small-latest";

const STORAGE_PART_LEN    = 110_000;
const CHUNK_TARGET_CHARS  = 6_500;
const CHUNK_OVERLAP_FRAC  = 0.01;
const MAX_CHUNKS_HARD     = 12;
const VARIANTS_PER_CHUNK  = 2;
const PARALLEL_REQUESTS   = 15;
const MAX_OUTPUT_TOKENS   = 3200;
const SEARCH_MAX_URLS     = 20;
const BATCH_URLS_PER_RUN  = 5;
const MAX_TITLE_WORDS     = 15;
const MAX_PER_SOURCE      = 12;

/** Budget / time guards */
const RUN_BUDGET_MS       = Number(Deno.env.get("RUN_BUDGET_MS") ?? 110_000);
const TAVILY_TIMEOUT_MS   = 12_000;
const MISTRAL_TIMEOUT_MS  = 12_000;

/** ========================== DOMAINS ========================== */
const ALLOWED_DOMAINS = [
  "a46.asmdc.org","aaas.org","abc.net.au","abcnews.go.com","acenet.edu","aclu.org",
  "actonclimate.com","aei.org","afp.com","afsc.org","ajmc.com","aljazeera.com",
  "americanimmigrationcouncil.org","americanprogress.org","apnews.com","arizonamirror.com",
  "armscontrol.org","assemblee-nationale.fr","atlanticcouncil.org","axios.com",
  "ballotpedia.org","ballotready.org","bankofengland.co.uk","bbc.com","bea.gov",
  "beverlyhills.org","bioguide.congress.gov","bipartisanpolicy.org","bjs.ojp.gov",
  "bloomberg.com","bls.gov","boe.es","brennancenter.org","britannica.com","brookings.edu",
  "bts.gov","budget.house.gov","budgetmodel.wharton.upenn.edu","bundesbank.de",
  "bundesrat.de","bundesregierung.de","bundestag.de","bundesverfassungsgericht.de",
  "c-span.org","caimmigrant.org","calbudgetcenter.org","californiahealthline.org",
  "calmatters.org","camera.it","campaignlegal.org","canada.ca","capitol.texas.gov",
  "carnegieendowment.org","carnegieeurope.eu","cato.org","cbc.ca","cbo.gov",
  "cbpp.org","ccltss.org","cdc.gov","cdt.org","cdflaborlaw.com","cdph.ca.gov",
  "census.gov","cfr.org","chathamhouse.org","christianitytoday.com","cityofchicago.org",
  "climate.law.columbia.edu","cnn.com","commonwealthfund.org","comptroller.texas.gov",
  "congress.gov","constitutioncenter.org","consumerfinance.gov","courtlistener.com",
  "crfb.org","csg.org","csis.org","csmonitor.com","ctmirror.org","curia.europa.eu",
  "data.ca.gov","data.cityofnewyork.us","data.gov","data.ny.gov","data.texas.gov",
  "dataverse.harvard.edu","dhs.gov","documentcloud.org","dos.myflorida.com","dot.gov",
  "dre.pt","dw.com","eac.gov","ecb.europa.eu","ecfr.gov","echr.coe.int",
  "econofact.org","ed.gov","edsource.org","edstrategy.org","eeas.europa.eu","eff.org",
  "eia.gov","electionlab.mit.edu","electionline.org","elections.ca","elections.ny.gov",
  "electionstudies.org","electoralcommission.org.uk","electproject.org","energy.gov",
  "energyinnovation.org","epa.gov","epi.org","eur-lex.europa.eu","europa.eu",
  "factcheck.org","fairvote.org","fbi.gov","fcc.gov","fda.gov","fdd.org","fec.gov",
  "federalregister.gov","federalreserve.gov","finra.org","flsenate.gov","foley.com",
  "followthemoney.org","france24.com","freepress.net","ftc.gov","gallup.com","gao.gov",
  "gazette.gc.ca","gazzettaufficiale.it","globalinitiative.net","goodjobsfirst.org",
  "gothamist.com","gov.ca.gov","gov.uk","gouvernement.fr","governor.ny.gov","govinfo.gov",
  "govtrack.us","gpo.gov","gsa.gov","harvard.edu","hhs.gov","hklaw.com","hoover.org",
  "house.gov","hrw.org","hud.gov","humanrightsmeasurement.org","icc-cpi.int","icj-cij.org",
  "icpsr.umich.edu","ifs.org.uk","ilga.gov","imf.org","insideclimatenews.org",
  "insidehighered.com","irs.gov","jec.senate.gov","justice.gc.ca","justice.gov",
  "justsecurity.org","kansasreflector.com","kff.org","laist.com","latimes.com",
  "law.berkeley.edu","law.cornell.edu","lawandcrime.com","lawfaremedia.org",
  "leg.colorado.gov","leg.wa.gov","legislation.gov.uk","leginfo.legislature.ca.gov",
  "legis.state.pa.us","loc.gov","malegislature.gov","manchesterdemocracy.org",
  "manhattan-institute.org","mass.gov","maynardnexsen.com","mercatus.org","michiganadvance.com",
  "millercenter.org","minnpost.com","morningconsult.com","myfloridahouse.gov","naco.org",
  "nap.edu","nasaa.org","nass.org","nato.int","nber.org","nbcbayarea.com","nces.ed.gov",
  "ncsc.org","ncsl.org","nea.org","nga.org","nhk.or.jp","nhtsa.gov","nih.gov","nilc.org",
  "noaa.gov","npr.org","nrdc.org","nyc.gov","nycbar.org","nycourts.gov","oag.ca.gov",
  "occrp.org","oecd.org","ohchr.org","oig.justice.gov","oireachtas.ie","ojp.gov",
  "opec.org","opensecrets.org","openstates.org","osce.org","ourcommons.ca","ourworldindata.org",
  "oversight.gov","oyez.org","parl.ca","parlamento.pt","parliament.uk","pbs.org",
  "pewresearch.org","pgpf.org","phila.gov","pogo.org","politico.com","politifact.com",
  "ppic.org","presidency.ucsb.edu","project-syndicate.org","propublica.org","prri.org",
  "psea.org","publicagenda.org","publichealth.berkeley.edu","publicintegrity.org",
  "publications.gc.ca","pwc.com","rand.org","randstatestats.org","reason.org",
  "regents.universityofcalifornia.edu","reginfo.gov","reporterslab.org","resolutionfoundation.org",
  "reuters.com","rferl.org","rfi.fr","rstreet.org","rte.ie","saisreview.sais.jhu.edu",
  "santamariatimes.com","sba.gov","sbs.com.au","scholars.org","scite.ai","sec.gov",
  "senat.fr","senate.gov","senato.it","sencanada.ca","siepr.stanford.edu","sierraclub.org",
  "sipri.org","smallwarsjournal.com","snopes.com","sos.ca.gov","sos.state.oh.us",
  "sos.texas.gov","sos.wa.gov","sph.emory.edu","ssa.gov","stateline.org","stinson.com",
  "stlouisfed.org","supremecourt.gov","taxfoundation.org","taxpolicycenter.org",
  "techpolicy.press","thebureauinvestigates.com","theguardian.com","theharrispoll.com",
  "thehill.com","themarkup.org","thetrace.org","tsinghua.edu.cn","treasury.gov",
  "ucla.edu","umn.edu","un.org","urban.org","usa.gov","usafacts.org","usaspending.gov",
  "usatoday.com","uscourts.gov","usda.gov","usgs.gov","usitc.gov","usmayors.org",
  "uww.universityofcalifornia.edu","verfassungsblog.de","voanews.com","votesmart.org",
  "voteview.com","warontherocks.com","wisconsinwatch.org","worldbank.org","wsj.com",
  "yahoo.com","yougov.com","americanactionforum.org","americorps.gov",
  // Pattern-based domains for comprehensive coverage
  "*.gov","*.state.*.us","*.edu","*.org"
] as const;

const MEDIA_DOMAINS = new Set<string>([
  "reuters.com","apnews.com","bbc.com","bloomberg.com","nytimes.com","wsj.com","ft.com","thehill.com","axios.com",
  "usatoday.com","rollcall.com","lawfaremedia.org","texastribune.org","statnews.com","npr.org","pbs.org",
  "pewresearch.org","kff.org","fivethirtyeight.com","yougov.com","politifact.com","snopes.com","afp.com","cbc.ca",
  "dw.com","abc.net.au"
]);

/** ========================== LLM JUDGE (for unknown domains) ========================== */
type LlmTypeVerdict = {
  verdict: "allow" | "block";
  score: number; // 0..10
  institution: "federal_gov" | "state_gov" | "local_gov" | "congress" | "committee" | "court" | "agency" | "edu" | "research_lab" | "hospital" | "media" | "think_tank" | "ngo" | "party" | "campaign" | "advocacy" | "unknown";
  official_affiliation: boolean;
  partisanship: "nonpartisan" | "mixed_official" | "partisan" | "unknown";
  reliability_signals: {
    publisher_identified: boolean;
    date_present: boolean;
    citations_or_primary_docs: boolean;
    byline_or_ownership: boolean;
  };
  content_flags: {
    press_release: boolean;
    news_clip_or_blog_rollup: boolean;
    opinion_or_editorial: boolean;
    thin_or_mostly_video: boolean;
  };
  recency_ok: boolean;
  subdomain_affiliation_ok: boolean;
  reasons: string[];
};

const _SYSTEM = `
You are a rigorous link-type and quality gate for a civic app. Judge ONLY the provided metadata and page snippet. Do not use outside knowledge. Follow the rules exactly and return strict JSON.

Rules:
- Allow gov/edu/research/hospital when official and not partisan; verify affiliation and subdomain.
- Allow Congress/committees only if not partisan (neutral docs: bills, schedules, transcripts, roll calls).
- Exclude: press releases, news clips/blog rollups, opinion/editorials — even on official sites.
- All sources must be ≤ 12 months old (recency_ok must be true), otherwise block.
- Media/think tanks/NGOs allowed if factual and transparent; bias alone is not a block, but partisan propaganda is blocked.
- Hospitals/health orgs allowed with factuality/quality checks.
- If the page is campaign/party/party-committee propaganda, block.
- Output valid JSON only, no commentary.
`;

function _userPrompt(args: {
  nowIso: string;
  person?: string;
  topic?: string;
  state?: string;
  meta: { url: string; host: string; title?: string; detected_date?: string | null; lang?: string | null };
  snippet: string;
}) {
  const { nowIso, person = "", topic = "", state = "", meta, snippet } = args;
  return `
REQUEST_CONTEXT = { "person": "${person}", "topic": "${topic}", "state": "${state}", "now_iso": "${nowIso}" }
PAGE_META = ${JSON.stringify(meta)}
PAGE_SNIPPET = """${snippet.slice(0, 4000)}"""
Return JSON with keys: verdict, score, institution, official_affiliation, partisanship, reliability_signals, content_flags, recency_ok, subdomain_affiliation_ok, reasons.
`.trim();
}

async function _mistralJudgeSmall(input: {
  meta: { url: string; host: string; title?: string; detected_date?: string | null; lang?: string | null };
  snippet: string;
  person?: string; topic?: string; state?: string;
  nowIso: string;
}): Promise<LlmTypeVerdict | null> {
  const body = {
    model: "mistral-small-latest",
    temperature: 0,
    max_tokens: 256,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: _SYSTEM },
      { role: "user", content: _userPrompt({ ...input }) }
    ]
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 1000);
  try {
    const r = await fetch(Deno.env.get("MISTRAL_API_URL") ?? "https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content ?? "";
    return _safeParseVerdict(txt);
  } catch {
    clearTimeout(t);
    const controller2 = new AbortController();
    const t2 = setTimeout(() => controller2.abort(), 1500);
    try {
      const r2 = await fetch(Deno.env.get("MISTRAL_API_URL") ?? "https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller2.signal
      });
      clearTimeout(t2);
      if (!r2.ok) return null;
      const j2 = await r2.json();
      const txt2 = j2?.choices?.[0]?.message?.content ?? "";
      return _safeParseVerdict(txt2);
    } catch {
      clearTimeout(t2);
      return null;
    }
  }
}

function _safeParseVerdict(s: string): LlmTypeVerdict | null {
  try {
    const jsonStart = s.indexOf("{");
    const jsonEnd = s.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(s.slice(jsonStart, jsonEnd + 1));
    if (typeof parsed?.verdict !== "string" || typeof parsed?.score !== "number") return null;
    return parsed as LlmTypeVerdict;
  } catch {
    return null;
  }
}

async function getReadableSnippet(url: string): Promise<string> {
  try {
    const text = await tavilyExtract(url);
    return text.slice(0, 4000);
  } catch {
    return "";
  }
}

/** ========================== CLIENT ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });

const trim = (s: unknown) => String(s ?? "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
const nowIso = () => new Date().toISOString();

function slugify(s: string) {
  return s.toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function hostFromUrl(u?: string | null): string | null {
  try { return u ? new URL(u).hostname.replace(/^www\./, "") : null; } catch { return null; }
}
function bareDomainLabelFromUrl(u: string): string {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "");
    const parts = h.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  } catch { return "site"; }
}
function tldOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./,"");
    const parts = h.split(".");
    return parts.length >= 2 ? parts[parts.length-1] : "";
  } catch { return ""; }
}

/** Enhanced domain matching with pattern support */
function matchesDomainPattern(url: string, pattern: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    // Exact match
    if (host === patternLower) return true;
    
    // Wildcard patterns
    if (patternLower.startsWith("*.")) {
      const suffix = patternLower.substring(2); // Remove "*."
      return host.endsWith("." + suffix) || host === suffix;
    }
    
    // State domain patterns (e.g., "*.state.ca.us" or "*.ca.gov")
    if (patternLower.includes("*.state.") || patternLower.includes("*.gov")) {
      const regex = new RegExp(patternLower.replace(/\*/g, ".*"));
      return regex.test(host);
    }
    
    return false;
  } catch { return false; }
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
      "dccc.org","nrcc.org","dlcc.org","rga.org","dga.org",
      "actblue.org","winred.com","moveon.org","indivisible.org",
      "americansforprosperity.org","clubforgrowth.org","freedomworks.org",
      "afpi.org","americafirstpolicy.com","americafirstpolicy.org","standtogether.org",
      "nra.org","nraila.org","sbaprolife.org","sba-list.org","marchforlife.org",
      "liveaction.org","familypolicyalliance.com","frc.org","heritageaction.com",
      "citizensunited.org","judicialwatch.org","projectveritas.com",
      "fairus.org","cis.org","numbersusa.org","aipac.org","jstreet.org",
      "ifamericansknew.org","christianvoterguide.com","catholicvote.org",
      "focusonthefamily.com","hrc.org","glaad.org","plannedparenthoodaction.org",
      "prochoiceamerica.org","nrlc.org","democracydocket.com","populardemocracy.org",
      "progressivepolicy.org","thirdway.org","justfacts.com",
      "peoplespolicyproject.org","project2025.org","aclj.org","aflcio.org",
      "seiu.org","teamster.org","gunowners.org","saf.org","firearmspolicy.org",
      "usccb.org","sutherlandinstitute.org","catholic.com","truthout.org",
      "dailykos.com","redstate.com","townhall.com","nationalreview.com",
      "thefederalist.com","washingtonexaminer.com","americanthinker.com",
      "jacobin.com","newrepublic.com","spectator.org","theamericanconservative.com",
      "foxnews.com","msnbc.com","newsmax.com","oann.com","pjmedia.com",
      "slate.com","motherjones.com","breitbart.com","theepochtimes.com",
      "thegatewaypundit.com",
      // Social media and personal sites
      "linkedin.com","wikipedia.org","en.wikipedia.org","texastribune.org",
      "x.com","twitter.com","instagram.com","facebook.com","youtube.com"
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

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove fragment
    u.hash = "";
    // Remove common UTM parameters
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic'];
    utmParams.forEach(param => u.searchParams.delete(param));
    // Normalize hostname (lowercase, remove www)
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    // Remove trailing slash from pathname (except root)
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Budget helpers */
const startTime = Date.now();
const deadline = startTime + RUN_BUDGET_MS;
const timeLeft = () => Math.max(0, deadline - Date.now());
const budgetOk = () => Date.now() < deadline;

async function fetchWithTimeout(input: RequestInfo, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort("timeout"), ms);
  try { return await fetch(input, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

/** Storage listing */
async function listLegiDir(id: number) {
  const { data, error } = await supabase.storage.from(WEB_BUCKET).list(`legi/${id}`, {
    limit: 1000, sortBy: { column: "name", order: "asc" }
  });
  if (error) throw error;
  return data?.filter(x => x && !x.name.endsWith("/"))?.map(x => `legi/${id}/${x.name}`) ?? [];
}

/** ========== Search & Extract (fixed) ========== */
async function tavilySearchCore(
  query: string,
  includeDomains?: string[] | null,
  max = SEARCH_MAX_URLS
): Promise<{ urls: string[]; http_status?: number; http_body?: string }> {
  if (!budgetOk()) return { urls: [] };
  const body: any = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: max,
    include_answer: false,
  };
  if (includeDomains && includeDomains.length > 0) {
    body.include_domains = includeDomains;
  }
  const r = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }, TAVILY_TIMEOUT_MS);
  if (!r.ok) {
    let txt = "";
    try { txt = await r.text(); } catch {}
    return { urls: [], http_status: r.status, http_body: txt || undefined };
  }
  const j = await r.json().catch(() => ({ results: [] }));
  const raw = (j?.results || []).map((x: any) => String(x?.url || "")).filter(Boolean);
  // Return all URLs without filtering - filtering happens in the calling function
  return { urls: raw };
}

/** Open search (no domain restrictions - filter after) */
async function tavilySearchFlexible(query: string, allowlist: string[]) {
  const p = await tavilySearchCore(query, null, SEARCH_MAX_URLS);
  return { urls: p.urls, pass_used: 1 as const, p1: p };
}

/** Open search for Round 2: completely open, no filtering */
async function tavilySearchOpen(query: string, max = SEARCH_MAX_URLS) {
  const p = await tavilySearchCore(query, null, max);
  return { urls: p.urls.slice(0, max), http_status: p.http_status, http_body: p.http_body };
}

async function tavilyExtract(url: string): Promise<string> {
  if (!budgetOk()) return "";
  const r = await fetchWithTimeout("https://api.tavily.com/extract", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_API_KEY, urls: [url], format: "markdown" })
  }, TAVILY_TIMEOUT_MS);
  if (!r.ok) throw new Error(`Tavily extract ${r.status}`);
  const j = await r.json();
  const entry = Array.isArray(j?.results) ? j.results[0] : j?.results?.[0] || j;
  const text = entry?.markdown || entry?.content || entry?.text || entry?.raw_content || entry?.html || "";
  return trim(text);
}
async function fetchHTMLWithUA(url: string): Promise<string> {
  if (!budgetOk()) return "";
  const r = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9", "Cache-Control": "no-cache", "Pragma": "no-cache"
    }
  }, TAVILY_TIMEOUT_MS);
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return await r.text();
}
async function fetchViaJinaReader(url: string): Promise<string> {
  if (!budgetOk()) return "";
  const bare = url.replace(/^https?:\/\//i, "");
  const proxied = `https://r.jina.ai/http://${bare}`;
  const r = await fetchWithTimeout(proxied, { headers: { "Accept": "text/plain,*/*;q=0.8" } }, TAVILY_TIMEOUT_MS);
  if (!r.ok) throw new Error(`Jina ${r.status}`);
  return await r.text();
}
function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ========================== SIMPLE YEAR PARSER ========================== */
function extractYear(subName?: string | null): string | null {
  if (!subName) return null;
  const left = String(subName).split("|")[0] || String(subName);
  const m1 = left.match(/(19|20)\d{2}/);
  if (m1) return m1[0];
  const m2 = String(subName).match(/(19|20)\d{2}/);
  return m2 ? m2[0] : null;
}

/** ========================== TITLE DEDUPE ========================== */
function titleSimilarity(a: string, b: string): number {
  const A = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const inter = new Set([...A].filter(x => B.has(x))).size;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
}

/** Split helpers */
function splitForStorage(text: string, size = STORAGE_PART_LEN): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.length ? parts : [text];
}
function splitForGeneration(text: string, maxChunks = MAX_CHUNKS_HARD) {
  const t = trim(text);
  if (!t) return [] as { idx: number; start: number; end: number; slice: string }[];
  const chunks: { idx: number; start: number; end: number; slice: string }[] = [];
  const step = Math.floor(CHUNK_TARGET_CHARS * (1 - CHUNK_OVERLAP_FRAC));
  for (let start = 0, i = 0; start < t.length && i < maxChunks; i++) {
    const end = Math.min(t.length, start + CHUNK_TARGET_CHARS);
    chunks.push({ idx: i, start, end, slice: t.slice(start, end) });
    if (end >= t.length) break;
    start = end - Math.floor(CHUNK_TARGET_CHARS * CHUNK_OVERLAP_FRAC);
  }
  return chunks;
}

/** ========================== MISTRAL ========================== */
type RawCard = {
  title: string;
  subtext: string;
  screen: string;     // "discourse" | "impact"
  category: string;   // discourse: backers|opposers|narratives|coverage
                      // impact:   sectors|demographics|regions|aftermath
  score?: number;
  score_reason?: string;
};

function clampScore(n: number) { return Math.max(1, Math.min(100, Math.round(n))); }
function fallbackScore(title: string, subtext: string): number {
  const t = `${title} ${subtext}`.toLowerCase();
  let score = 40;
  if (/\bnationwide\b|\bnational\b|\ball\b/.test(t)) score += 20;
  if (/\bpermanent\b|\bno sunset\b/.test(t)) score += 10;
  if (/\bban\b|\bcut\b|\blose\b|\bterminate\b/.test(t)) score += 10;
  if (/\breport\b|\bstudy\b|\bguidance\b/.test(t)) score -= 10;
  return clampScore(score);
}
function coerceScore(score: any, title: string, subtext: string): number {
  const n = Number(score);
  return Number.isFinite(n) ? clampScore(n) : fallbackScore(title, subtext);
}

async function mistralOnce(opts: {
  billName: string;
  pageText: string;
  wantMax?: number;
}): Promise<RawCard[] | null> {
  if (!budgetOk()) return null;

  const sys = `
You read one article and produce cards about a bill without inventing any details.
Two screens:
1) "discourse" (backers|opposers|narratives|coverage)
   - Reflect what third parties (groups, outlets, unions, think tanks, industry, advocacy orgs, parties) are saying and why.
   - Do NOT restate agenda items unless strictly needed for context.
   - If no third-party framing exists in the article, return none for discourse.

2) "impact" (sectors|demographics|regions|aftermath) — TITLES MUST LEAD WITH IMPACT, not policy text:
   - sectors: Start with the public/private sector affected, then the specific effect.
   - demographics: Start with the demographic affected (income/race/age/etc.), then the effect.
   - regions: Start with the region/area; region must appear in the title.
   - aftermath: Start with the projected result (e.g., "CBO projects ..."), then what drives it.
   If you cannot satisfy the above rule for a given impact category from the article text, SKIP that card.

Output ONLY JSON: {"cards":[{ ... }]}
Each card:
- "title": 6–15 words, plain and concise.
- "subtext": one sentence, neutral, HS reading level.
- "screen": "discourse" or "impact".
- "category": one of the allowed categories for that screen.
- (optional) "score" 1-100 and short "score_reason".

Strict:
- Use only the article information; do NOT invent actors, numbers, motives, regions, or demographics.
- Skip agenda-only statements with no third-party framing (for discourse).
- Skip impact cards if you cannot form the required lead from the article text.
`.trim();

  const usr = `
BILL: ${opts.billName}
MAX_CARDS_HINT: ${Math.max(12, opts.wantMax ?? 24)}

ARTICLE TEXT (plain):
"""${opts.pageText}"""

Return JSON:
{"cards":[
  {"title":"...", "subtext":"...", "screen":"discourse|impact",
   "category":"backers|opposers|narratives|coverage|sectors|demographics|regions|aftermath",
   "score":85, "score_reason":"affects millions long-term"}
]}
`.trim();

  const r = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({
      model: MODEL_ID,
      temperature: 0.25,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
    }),
  }, MISTRAL_TIMEOUT_MS).catch(() => null);

  if (!r) return null;
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  const content = j?.choices?.[0]?.message?.content ?? "{}";

  let parsed: any = {};
  try { parsed = JSON.parse(content); }
  catch {
    const a = content.indexOf("{"), b = content.lastIndexOf("}");
    if (a >= 0 && b > a) { try { parsed = JSON.parse(content.slice(a, b + 1)); } catch {} }
  }

  const arr = Array.isArray(parsed?.cards) ? parsed.cards : [];
  return arr.map((c: any) => ({
    title: trim(c?.title || "").split(/\s+/).slice(0, MAX_TITLE_WORDS).join(" "),
    subtext: trim(c?.subtext || ""),
    screen: (c?.screen || "").toLowerCase(),
    category: (c?.category || "").toLowerCase(),
    score: Number.isFinite(Number(c?.score)) ? clampScore(Number(c?.score)) : undefined,
    score_reason: trim(c?.score_reason || "")
  })).filter(c =>
    c.title && c.subtext &&
    ((c.screen === "discourse" && ["backers","opposers","narratives","coverage"].includes(c.category)) ||
     (c.screen === "impact"   && ["sectors","demographics","regions","aftermath"].includes(c.category)))
  );
}

/** ========================== POOL ========================== */
async function runPool<T>(limit: number, tasks: (() => Promise<T>)[], budgetStop?: () => boolean): Promise<T[]> {
  const results: T[] = new Array(tasks.length) as T[];
  let i = 0;
  const next = async (): Promise<void> => {
    const cur = i++;
    if (cur >= tasks.length) return;
    if (budgetStop && budgetStop()) { /* @ts-ignore */ results[cur] = null; return; }
    try { results[cur] = await tasks[cur](); }
    catch { /* @ts-ignore */ results[cur] = null; }
    return next();
  };
  const n = Math.min(limit, tasks.length);
  await Promise.all([...Array(n)].map(() => next()));
  return results;
}

/** ========================== DB HELPERS ========================== */
async function getLegiRow(id: number) {
  const { data, error } = await supabase
    .from("legi_index")
    .select("id, name, sub_name, scanned")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("legi_index row not found");
  return data as { id: number; name: string; sub_name: string | null; scanned: number | null };
}
async function getExistingLinks(ownerId: number): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("web_content")
    .select("link")
    .eq("owner_id", ownerId)
    .eq("is_ppl", false);
  if (error) return new Set();
  const normalizedLinks = (data || []).map(row => normalizeUrl(row.link || "")).filter(Boolean);
  return new Set(normalizedLinks);
}
async function findUnusedCoverageRows(id: number, limit = BATCH_URLS_PER_RUN) {
  const { data, error } = await supabase
    .from("web_content")
    .select("id, path, link, used")
    .eq("owner_id", id)
    .eq("is_ppl", false)
    .like("path", `legi/${id}/coverage.%`)
    .is("used", null)
    .limit(limit);
  if (error) throw error;
  const nullRows = data || [];
  if (nullRows.length < limit) {
    const { data: fRows } = await supabase
      .from("web_content")
      .select("id, path, link, used")
      .eq("owner_id", id)
      .eq("is_ppl", false)
      .like("path", `legi/${id}/coverage.%`)
      .eq("used", false)
      .limit(limit - nullRows.length);
    return [...nullRows, ...(fRows || [])].slice(0, limit);
  }
  return nullRows;
}
async function insertWebContent(ownerId: number, link: string): Promise<number> {
  const { data, error } = await supabase
    .from("web_content")
    .insert({ path: "pending", owner_id: ownerId, is_ppl: false, link, used: false })
    .select("id")
    .single();
  if (error || !data) throw error || new Error("web_content insert failed");
  return data.id as number;
}
async function markUsed(webId: number) {
  await supabase.from("web_content").update({ used: true }).eq("id", webId);
}
async function putToStorage(path: string, content: string) {
  const { error } = await supabase.storage.from(WEB_BUCKET).upload(
    path, new Blob([content], { type: "text/plain; charset=utf-8" }),
    { upsert: true, contentType: "text/plain; charset=utf-8" }
  );
  if (error) throw error;
}
async function listCoveragePartsForWeb(id: number, webId: number, label: string) {
  const all = await listLegiDir(id);
  const prefix = `legi/${id}/coverage.${webId}.${label}`;
  const mine = all.filter(p => p.startsWith(prefix));
  const sorted = mine.sort((a, b) => {
    const getPart = (p: string) => {
      const m = p.match(/\.([0-9]+)\.txt$/);
      return m ? parseInt(m[1], 10) : 0;
    };
    return getPart(a) - getPart(b);
  });
  return sorted.length ? sorted : mine;
}

/** Coverage presence gate (for Round 2 trigger) */
async function hasCoverageCards(ownerId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from("card_index")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("is_ppl", false)
    .eq("screen", "discourse")
    .eq("category", "coverage");
  if (error) return false;
  // @ts-ignore: supabase-js v2 returns count on head:true
  const count = (data as any)?.length ?? (error ? 0 : 0);
  // Safer: re-run with no head to get count if needed
  if (count !== undefined && count !== null) return count > 0;

  const { data: rows } = await supabase
    .from("card_index")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("is_ppl", false)
    .eq("screen", "discourse")
    .eq("category", "coverage")
    .limit(1);
  return !!(rows && rows.length);
}

/** ========================== SEARCH (NAME + YEAR) ========================== */
function buildSearchQuery(billName: string, year: string | null): string {
  const quoted = `"${billName}"`;
  const y = year ? ` ${year}` : "";
  return `${quoted}${y}`;
}

async function searchAndStoreSources(
  id: number,
  billName: string,
  year: string | null
): Promise<{ fetched_urls: string[]; stored: number; debug: any }> {
  let fetched_urls: string[] = [];
  let stored = 0;

  const query = buildSearchQuery(billName, year);
  let urls: string[] = [];

  const debug: any = {
    search_query: query,
    tavily_urls: 0,
    after_extract: 0,
    stored: 0,
    pass_used: 0,
    duplicates_skipped: 0
  };

  // Get existing links to avoid duplicates
  const existingLinks = await getExistingLinks(id);

  try {
    const flex = await tavilySearchFlexible(query, Array.from(ALLOWED_DOMAINS));
    debug.tavily_urls = flex.urls.length;
    if (flex.p1?.http_status) debug.tavily_http_status = flex.p1.http_status;
    if (flex.p1?.http_body)   debug.tavily_http_body   = flex.p1.http_body;
    urls = flex.urls;
  } catch (e: any) {
    debug.tavily_error = String(e?.message || e);
    urls = [];
  }

  const nowIsoStr = nowIso();
  debug.llm_judgments = { blocked: 0, allowlist_passed: 0, unknown_rejected: 0, unknown_accepted: 0, llm_error: 0 };
  debug.llm_verdicts = [] as any[];

  for (const urlStr of urls) {
    if (!budgetOk()) break;
    
    // Check for duplicates
    const normalizedUrl = normalizeUrl(urlStr);
    if (existingLinks.has(normalizedUrl)) {
      debug.duplicates_skipped++;
      continue;
    }
    
    const host = hostFromUrl(urlStr) || "";
    
    // 1. Check if blocked
    if (isBlockedDomain(urlStr)) {
      debug.llm_judgments.blocked++;
      continue;
    }
    
    // 2. Check if in allow list
    const isAllowed = Array.from(ALLOWED_DOMAINS).some(d => matchesDomainPattern(urlStr, d));
    
    try {
      let text = "";
      try {
        text = await tavilyExtract(urlStr);
        if (!text) throw new Error("empty");
      } catch {
        try {
          const html = await fetchHTMLWithUA(urlStr);
          const plain = stripHtml(html);
          text = trim(plain || html);
        } catch {
          text = trim(await fetchViaJinaReader(urlStr));
        }
      }
      if (!text) continue;
      debug.after_extract++;
      
      // 3. If allowed, pass through. If unknown, run LLM judge
      if (isAllowed) {
        debug.llm_judgments.allowlist_passed++;
      } else {
        // Unknown domain - run LLM judge
        const snippet = text.slice(0, 4000);
        const verdict = await _mistralJudgeSmall({
          meta: { url: urlStr, host, title: undefined, detected_date: null, lang: null },
          snippet,
          topic: billName,
          nowIso: nowIsoStr
        });
        
        if (!verdict) {
          debug.llm_judgments.llm_error++;
          debug.llm_verdicts.push({ url: urlStr, host, status: "llm_error" });
          continue;
        }
        
        const isOfficial = ["federal_gov","state_gov","local_gov","congress","committee","court","agency","edu","research_lab","hospital"].includes(verdict.institution);
        const excluded = verdict.content_flags.press_release || 
                        verdict.content_flags.news_clip_or_blog_rollup || 
                        verdict.content_flags.opinion_or_editorial;
        
        let rejectReason = "";
        
        // Policy checks
        if (!verdict.recency_ok) {
          rejectReason = "stale (>12 months)";
        } else if (excluded) {
          const flags = [];
          if (verdict.content_flags.press_release) flags.push("press_release");
          if (verdict.content_flags.news_clip_or_blog_rollup) flags.push("news_clip");
          if (verdict.content_flags.opinion_or_editorial) flags.push("opinion");
          rejectReason = `excluded_content: ${flags.join(", ")}`;
        } else if (isOfficial && (!verdict.official_affiliation || !verdict.subdomain_affiliation_ok)) {
          rejectReason = "affiliation_fail";
        } else if (["party","campaign","advocacy"].includes(verdict.institution) || verdict.partisanship === "partisan") {
          rejectReason = `partisan (${verdict.institution})`;
        } else if (verdict.verdict !== "allow" || verdict.score < 7.0) {
          rejectReason = `below_threshold (score: ${verdict.score}, verdict: ${verdict.verdict})`;
        }
        
        if (rejectReason) {
          debug.llm_judgments.unknown_rejected++;
          debug.llm_verdicts.push({
            url: urlStr,
            host,
            status: "rejected",
            reason: rejectReason,
            verdict: verdict.verdict,
            score: verdict.score,
            institution: verdict.institution,
            partisanship: verdict.partisanship,
            recency_ok: verdict.recency_ok,
            content_flags: verdict.content_flags,
            llm_reasons: verdict.reasons
          });
          continue;
        }
        
        debug.llm_judgments.unknown_accepted++;
        debug.llm_verdicts.push({
          url: urlStr,
          host,
          status: "accepted",
          score: verdict.score,
          institution: verdict.institution
        });
      }

      const label = bareDomainLabelFromUrl(urlStr);
      const webId = await insertWebContent(id, urlStr);
      const parts = splitForStorage(text, STORAGE_PART_LEN);
      const paths: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        const suffix = parts.length > 1 ? `.${i + 1}` : "";
        const key = `legi/${id}/coverage.${webId}.${label}${suffix}.txt`;
        await putToStorage(key, parts[i]);
        paths.push(key);
      }
      await supabase.from("web_content").update({ path: paths[0] }).eq("id", webId);
      fetched_urls.push(urlStr);
      stored++;
      debug.stored++;
      // Add to existing links set to prevent duplicates in same batch
      existingLinks.add(normalizedUrl);
      if (!budgetOk()) break;
    } catch { /* skip */ }
  }

  return { fetched_urls, stored, debug };
}

/** Round-2: Open search (coverage-only usage) */
async function searchAndStoreSourcesRound2Open(
  id: number,
  billName: string,
  year: string | null
): Promise<{ fetched_urls: string[]; web_ids: number[]; debug: any }> {
  const query = buildSearchQuery(billName, year);
  const debug: any = { search_query_round2: query, urls: 0, after_extract: 0, stored: 0, http_status: null, http_body: null, duplicates_skipped: 0 };

  // Get existing links to avoid duplicates
  const existingLinks = await getExistingLinks(id);

  const got = await tavilySearchOpen(query, SEARCH_MAX_URLS);
  debug.urls = got.urls.length;
  if (got.http_status) debug.http_status = got.http_status;
  if (got.http_body)   debug.http_body   = got.http_body;

  const fetched_urls: string[] = [];
  const web_ids: number[] = [];
  const nowIsoStr = nowIso();
  debug.llm_judgments = { unknown_rejected: 0, unknown_accepted: 0, llm_error: 0 };
  debug.llm_verdicts = [] as any[];

  for (const urlStr of got.urls) {
    if (!budgetOk()) break;
    
    // Check for duplicates
    const normalizedUrl = normalizeUrl(urlStr);
    if (existingLinks.has(normalizedUrl)) {
      debug.duplicates_skipped++;
      continue;
    }
    
    const host = hostFromUrl(urlStr) || "";
    
    // Check if blocked
    if (isBlockedDomain(urlStr)) {
      continue;
    }
    
    // Check if in allow list - pass through without LLM
    const isAllowed = Array.from(ALLOWED_DOMAINS).some(d => matchesDomainPattern(urlStr, d));
    
    try {
      let text = "";
      try {
        text = await tavilyExtract(urlStr);
        if (!text) throw new Error("empty");
      } catch {
        try {
          const html = await fetchHTMLWithUA(urlStr);
          const plain = stripHtml(html);
          text = trim(plain || html);
        } catch {
          text = trim(await fetchViaJinaReader(urlStr));
        }
      }
      if (!text) continue;
      debug.after_extract++;
      
      // Skip LLM judge if allowed domain
      if (isAllowed) {
        debug.llm_judgments.unknown_accepted++;
      } else {
        // LLM judge for unknown domains (full gate)
        const snippet = text.slice(0, 4000);
        const verdict = await _mistralJudgeSmall({
          meta: { url: urlStr, host, title: undefined, detected_date: null, lang: null },
          snippet,
          topic: billName,
          nowIso: nowIsoStr
        });
        
        if (!verdict) {
          debug.llm_judgments.llm_error++;
          debug.llm_verdicts.push({ url: urlStr, host, status: "llm_error" });
          continue;
        }
        
        const isOfficial = ["federal_gov","state_gov","local_gov","congress","committee","court","agency","edu","research_lab","hospital"].includes(verdict.institution);
        const excluded = verdict.content_flags.press_release || 
                        verdict.content_flags.news_clip_or_blog_rollup || 
                        verdict.content_flags.opinion_or_editorial;
        
        let rejectReason = "";
        
        // Policy checks
        if (!verdict.recency_ok) {
          rejectReason = "stale (>12 months)";
        } else if (excluded) {
          const flags = [];
          if (verdict.content_flags.press_release) flags.push("press_release");
          if (verdict.content_flags.news_clip_or_blog_rollup) flags.push("news_clip");
          if (verdict.content_flags.opinion_or_editorial) flags.push("opinion");
          rejectReason = `excluded_content: ${flags.join(", ")}`;
        } else if (isOfficial && (!verdict.official_affiliation || !verdict.subdomain_affiliation_ok)) {
          rejectReason = "affiliation_fail";
        } else if (["party","campaign","advocacy"].includes(verdict.institution) || verdict.partisanship === "partisan") {
          rejectReason = `partisan (${verdict.institution})`;
        } else if (verdict.verdict !== "allow" || verdict.score < 7.0) {
          rejectReason = `below_threshold (score: ${verdict.score}, verdict: ${verdict.verdict})`;
        }
        
        if (rejectReason) {
          debug.llm_judgments.unknown_rejected++;
          debug.llm_verdicts.push({
            url: urlStr,
            host,
            status: "rejected",
            reason: rejectReason,
            verdict: verdict.verdict,
            score: verdict.score,
            institution: verdict.institution,
            partisanship: verdict.partisanship,
            recency_ok: verdict.recency_ok,
            content_flags: verdict.content_flags,
            llm_reasons: verdict.reasons
          });
          continue;
        }
        
        debug.llm_judgments.unknown_accepted++;
        debug.llm_verdicts.push({
          url: urlStr,
          host,
          status: "accepted",
          score: verdict.score,
          institution: verdict.institution
        });
      }

      const label = bareDomainLabelFromUrl(urlStr);
      const webId = await insertWebContent(id, urlStr);
      const parts = splitForStorage(text, STORAGE_PART_LEN);
      for (let i = 0; i < parts.length; i++) {
        const suffix = parts.length > 1 ? `.${i + 1}` : "";
        const key = `legi/${id}/coverage.${webId}.${label}${suffix}.txt`;
        await putToStorage(key, parts[i]);
      }
      await supabase.from("web_content").update({ path: `legi/${id}/coverage.${webId}.${label}.txt` }).eq("id", webId);

      fetched_urls.push(urlStr);
      web_ids.push(webId);
      debug.stored++;
      // Add to existing links set to prevent duplicates in same batch
      existingLinks.add(normalizedUrl);
    } catch { /* skip */ }
  }

  return { fetched_urls, web_ids, debug };
}

/** ========================== MAIN ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });

    // read id
    const url = new URL(req.url);
    let id: number | null = null;
    const qId = url.searchParams.get("id");
    if (qId && /^\d+$/.test(qId)) id = Number(qId);
    if (!id) {
      const ctype = req.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const j = await req.json().catch(() => ({}));
        if (typeof j?.id === "number") id = j.id;
        else if (typeof j?.id === "string" && /^\d+$/.test(j.id)) id = Number(j.id);
      } else {
        const raw = (await req.text().catch(() => "")).trim();
        if (/^\d+$/.test(raw)) id = Number(raw);
      }
    }
    if (!id) return json(400, { error: "Missing or invalid id." });

    const bill = await getLegiRow(id);
    const billName = bill.name || `Bill ${id}`;
    const year = extractYear(bill.sub_name);

    // Check coverage presence BEFORE any generation (to allow round2 even if no new cards created now)
    const hadCoverageBefore = await hasCoverageCards(id);

    // 1) pick up to BATCH_URLS_PER_RUN unused
    let targets = await findUnusedCoverageRows(id, BATCH_URLS_PER_RUN);

    // 2) if none, search by NAME + YEAR (allowlist), store, then re-pull
    let fetched_urls: string[] = [];
    let searchDebug: any = null;
    if (!targets.length && budgetOk()) {
      const { fetched_urls: got, stored, debug } = await searchAndStoreSources(id, billName, year);
      fetched_urls = got;
      searchDebug = debug;
      if (stored > 0) {
        targets = await findUnusedCoverageRows(id, BATCH_URLS_PER_RUN);
      }
    }

    // If still none, we might still proceed to round2 later if hadCoverageBefore==true
    if (!targets.length && !hadCoverageBefore) {
      return json(200, {
        id, fetched_urls, processed_web_ids: [], inserted: 0, details: [],
        stop_reason: budgetOk() ? "no_sources" : "budget_exhausted",
        search_debug: searchDebug
      });
    }

    // Existing slugs for global dedup
    const { data: existing, error: exErr } = await supabase
      .from("card_index")
      .select("slug, title, screen, category")
      .eq("owner_id", id)
      .eq("is_ppl", false);
    if (exErr) throw exErr;
    const existingSlugs = new Set<string>((existing || []).map((r: any) => String(r.slug || "")));

    const processed_web_ids: number[] = [];
    const details: any[] = [];
    const insertedRows: any[] = [];

    // Helper to process a batch of web ids; if coverageOnly==true then drop impact cards
    const processTargets = async (rows: any[], coverageOnly: boolean) => {
      for (const row of rows) {
        if (!budgetOk()) break;

        const webId = row.id as number;
        const link  = String(row.link || "");
        const host  = hostFromUrl(link);
        const is_media = host ? MEDIA_DOMAINS.has(host) || Array.from(MEDIA_DOMAINS).some(d => (host === d || host.endsWith("." + d))) : false;
        const label = bareDomainLabelFromUrl(link);

        const parts = await listCoveragePartsForWeb(id, webId, label);
        let totalCards = 0;

        for (const p of parts) {
          if (!budgetOk()) break;
          if (totalCards >= MAX_PER_SOURCE) break;

          const { data: fileObj } = await supabase.storage.from(WEB_BUCKET).download(p);
          if (!fileObj) continue;
          const pageTextRaw = await fileObj.text();
          const pageText = trim(pageTextRaw);
          if (!pageText) continue;

          const chunksAll = splitForGeneration(pageText, MAX_CHUNKS_HARD);
          let chunks = chunksAll;
          if (timeLeft() < 40_000) chunks = chunksAll.slice(0, Math.max(2, Math.ceil(chunksAll.length / 3)));
          if (timeLeft() < 20_000) chunks = chunksAll.slice(0, 1);

          const tasks: (() => Promise<RawCard[] | null>)[] = [];
          for (const ch of chunks) {
            for (let v = 0; v < VARIANTS_PER_CHUNK; v++) {
              tasks.push(() => mistralOnce({ billName, pageText: ch.slice, wantMax: 24 }));
            }
          }

          const results = await runPool(PARALLEL_REQUESTS, tasks, () => !budgetOk());
          let gathered = (results.flat().filter(Boolean) as RawCard[])
            .map(c => ({
              title: c.title,
              subtext: c.subtext,
              screen: c.screen,
              category: c.category,
              score: c.score,
              score_reason: c.score_reason
            }))
            .filter(c =>
              (c.screen === "discourse" && ["backers","opposers","narratives","coverage"].includes(c.category)) ||
              (c.screen === "impact"   && ["sectors","demographics","regions","aftermath"].includes(c.category))
            );

          if (coverageOnly) {
            gathered = gathered.filter(c => c.screen === "discourse" && c.category === "coverage");
          }

          // Dedup (slug + same-category near-duplicate by title)
          const batchOut: any[] = [];
          const perSourceKept: { [cat: string]: { title: string; slug: string }[] } = {};
          const batchSlugSet = new Set<string>();

          for (const c of gathered) {
            if (totalCards + batchOut.length >= MAX_PER_SOURCE) break;

            const slug = slugify(`${c.screen}:${c.category}:${c.title}`);
            if (existingSlugs.has(slug) || batchSlugSet.has(slug)) continue;

            const list = perSourceKept[c.category] || [];
            const isNear = list.some(x => titleSimilarity(x.title, c.title) >= 0.9);
            if (isNear) continue;

            batchSlugSet.add(slug);
            (perSourceKept[c.category] ||= []).push({ title: c.title, slug });

            const computedScore = coerceScore(c.score, c.title, c.subtext);

            batchOut.push({
              owner_id: id,
              created_at: nowIso(),
              title: c.title,
              subtext: c.subtext,
              screen: c.screen,
              category: c.category,
              score: computedScore,
              is_media,
              link,
              is_active: true,
              web: p,
              slug,
              is_ppl: false,
              opens_7d: 0,
              web_id: webId,
              bill_section: null
            });
          }

          const remaining = Math.max(0, MAX_PER_SOURCE - totalCards);
          const toInsert = batchOut.slice(0, remaining);

          if (toInsert.length) {
            const { data: ins } = await supabase.from("card_index").insert(toInsert).select("id, slug");
            if (ins?.length) {
              insertedRows.push(...ins);
              for (const r of toInsert) existingSlugs.add(r.slug);
              totalCards += ins.length;
            }
          }

          if (!budgetOk()) break;
        }

        await markUsed(webId);
        processed_web_ids.push(webId);
        details.push({ web_id: webId, link, parts_scanned: parts.length, generated: totalCards });

        if (!budgetOk()) break;
      }
    };

    // ========== Process ROUND 1 targets (normal) ==========
    if (targets.length) {
      await processTargets(targets, /*coverageOnly*/ false);
    }

    // ========== Decide ROUND 2 (open domains, coverage-only) ==========
    let round2Debug: any = null;
    if (budgetOk()) {
      const coverageNow = hadCoverageBefore || await hasCoverageCards(id);
      if (coverageNow) {
        const { fetched_urls: r2urls, web_ids: r2webs, debug } =
          await searchAndStoreSourcesRound2Open(id, billName, year);
        round2Debug = debug;

        if (r2webs.length && budgetOk()) {
          // fetch the newly created rows for those web_ids
          const { data: r2rows } = await supabase
            .from("web_content")
            .select("id, path, link, used")
            .in("id", r2webs);
          if (r2rows && r2rows.length) {
            await processTargets(r2rows, /*coverageOnly*/ true);
          }
        }
      }
    }

    const stop_reason = budgetOk() ? "completed_within_budget" : "budget_exhausted";
    return json(200, {
      id,
      processed_web_ids,
      inserted: insertedRows.length,
      details,
      stop_reason,
      time_ms: Date.now() - startTime,
      search_debug: searchDebug,
      round2_debug: round2Debug
    });
  } catch (e: any) {
    console.error(e);
    return json(500, { error: String(e?.message || e || "unknown error") });
  }
});
