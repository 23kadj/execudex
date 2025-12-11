/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ======= config ======= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";
const MAX_LEN = Number.POSITIVE_INFINITY;
const PART_LEN = 110_000; // max chars per stored part

/** —— reliability limits —— */
const RUN_BUDGET_MS      = Number(Deno.env.get("RUN_BUDGET_MS") ?? 25_000);
const SEARCH_TIMEOUT_MS  = 8_000;
const EXTRACT_TIMEOUT_MS = 12_000;
const PER_TERM_TARGET    = 8;      // cap stored sources per term
const POOL_LIMIT         = 6;      // max concurrent extracts/stores

/** ======= allowed domains ======= (unchanged core + additions) */
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
  "yahoo.com","yougov.com","americanactionforum.org","americorps.gov"
] as const;

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

  const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
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

/** ======= supabase client ======= */
const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE!, { global: { fetch } });

/** ---------- timing/budget helpers ---------- */
const startTime = Date.now();
const budgetOk = () => Date.now() - startTime < RUN_BUDGET_MS;

function fetchWithTimeout(input: RequestInfo, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

/** ---------- input helpers ---------- */
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
    const raw = (await req.text().catch(() => "")).trim();
    if (/^\d+$/.test(raw)) return Number(raw);
  }
  throw new Error("bad_request_id");
}

/** Parse search terms from body or query. Default to ["agenda"] if none provided. */
async function readTerms(req: Request): Promise<string[]> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  let terms: string[] | undefined;

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (Array.isArray(j?.terms)) terms = j.terms.filter((s: unknown) => typeof s === "string");
    else if (Array.isArray(j?.categories)) terms = j.categories.filter((s: unknown) => typeof s === "string");
    else if (typeof j?.query === "string") terms = j.query.split(",").map((s: string) => s.trim()).filter(Boolean);
    else if (typeof j?.q === "string") terms = j.q.split(",").map((s: string) => s.trim()).filter(Boolean);
  }
  if (!terms && typeof q === "string") terms = q.split(",").map((s) => s.trim()).filter(Boolean);
  if (!terms || terms.length === 0) return ["agenda"];
  return terms;
}

/** Keep only the first path segment and slugify */
function slugifyTerm(t: string): string {
  const first = t.split("/")[0];
  const lower = first.toLowerCase().trim();
  const dashed = lower
    .replace(/\s+/g, "-").replace(/[_.]+/g, "-").replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "");
  return dashed || "term";
}

/** ---------- URL/domain helpers ---------- */
function matchAllowedDomain(u: string): string | null {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return (ALLOWED_DOMAINS as readonly string[]).includes(host) ? host : null;
  } catch { return null; }
}

function normalizedHost(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Comprehensive domain blocking for biased/partisan content */
function isBlockedDomain(url: string): boolean {
  try {
    const host = normalizedHost(url);
    if (!host) return false;
    const path = new URL(url).pathname.toLowerCase();
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
function bareDomainLabelFromUrl(u: string): string {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch { return "site"; }
}

/** ---------- text & storage helpers ---------- */
function splitIntoParts(text: string, size = PART_LEN): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.length ? parts : [text];
}
async function putToStorage(path: string, content: string) {
  const { error } = await supabase.storage.from(WEB_BUCKET).upload(
    path, new Blob([content], { type: "text/plain; charset=utf-8" }),
    { upsert: true, contentType: "text/plain; charset=utf-8" }
  );
  if (error) throw error;
}

/** ---------- Policy/action scoring ---------- */
const POLICY_KEYWORDS = [
  "executive order","eo ","proclamation","signed into law","enacted","implementation","implemented",
  "final rule","rulemaking","nprm","interim final rule","regulation","directive","memorandum",
  "agency guidance","ordinance","resolution","order","program launched","pilot program",
  "bill","public law","pl ","stat.","hr ","s. ","h.r.","s."
];

const POLICY_DOMAINS_BONUS = new Set([
  "congress.gov","govtrack.us","federalregister.gov","ecfr.gov","law.cornell.edu",
  "house.gov","senate.gov","gpo.gov","govinfo.gov","uscourts.gov",
  "openstates.org","ncsl.org","nga.org","naco.org",
]);

function policySignalFromUrl(url: string): number {
  let score = 0, host = "", path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    path = (u.pathname + " " + (u.search || "")).toLowerCase();
  } catch {}
  if (POLICY_DOMAINS_BONUS.has(host)) score += 18;
  if (host.endsWith(".gov")) score += 10;

  const HINTS = [
    "/bill/","/bills/","/legislation/","/public-law/","/pl-","/stat/",
    "/executive-order","/executive-orders","/presidential-documents",
    "/final-rule","/rule","/rulemaking","/nprm","/proposed-rule",
    "/regulation","/regulations/","/fr","/ecfr",
    "/proclamation","/memo","/memorandum","/directive",
    "/ordinance","/resolution","/order"
  ];
  for (const h of HINTS) if (path.includes(h)) score += 6;
  for (const kw of POLICY_KEYWORDS) if (path.includes(kw)) score += 3;
  return score;
}

/** ---------- freshness ranking ---------- */
function extractYearsFromUrl(url: string): number[] {
  const out: number[] = [];
  try {
    const path = new URL(url).pathname.toLowerCase();
    for (const m of path.matchAll(/\b(19|20)\d{2}\b/g)) out.push(Number(m[0]));
  } catch {}
  return out;
}
function hasYearInParens(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\((?:[^()]*?(19|20)\d{2}[^()]*)\)/.test(path);
  } catch { return false; }
}
const TRUSTED_SOURCES = new Set([
  "reuters.com","apnews.com","bbc.com","thehill.com","bloomberg.com","axios.com",
  "gallup.com","morningconsult.com","yougov.com","fivethirtyeight.com","pewresearch.org","kff.org",
  "ballotpedia.org","presidency.ucsb.edu"
]);
function rankFreshnessGeneric(url: string): number {
  let score = 100;
  const nowYear = new Date().getUTCFullYear();
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const pathSegs = (() => { try { return new URL(url).pathname.split("/").filter(Boolean).length; } catch { return 0; } })();

  const years = extractYearsFromUrl(url);
  for (const y of years) {
    if (y <= nowYear - 2) score -= 35;
    else if (y === nowYear - 1) score -= 10;
    else if (y >= nowYear) score += 5;
  }
  if (hasYearInParens(url)) score -= 25;

  if (TRUSTED_SOURCES.has(host)) score += 12;
  if (host.endsWith(".gov")) score += 12;

  score -= Math.min(20, Math.floor(pathSegs / 2));
  return score;
}

/** ---------- combined re-ranking (freshness + policy) ---------- */
function rankUrlsByFreshness(urls: string[]): string[] {
  return urls
    .map(u => ({ u, s: rankFreshnessGeneric(u) + policySignalFromUrl(u) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.u);
}

/** ---------- Search (two-pass flexible) ---------- */
async function tavilySearchCore(query: string, includeDomains?: string[] | null, max = 20): Promise<string[]> {
  if (!budgetOk()) return [];
  const body: any = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: max,
    include_answer: false
  };
  if (includeDomains?.length) body.include_domains = includeDomains;

  const r = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, SEARCH_TIMEOUT_MS).catch(() => null);

  if (!r || !r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const list: Array<{ url?: string }> = j?.results || j?.data || [];
  return list.map((x) => String(x?.url || "")).filter(Boolean);
}

async function tavilySearchFlexible(query: string, allowlist: string[]): Promise<string[]> {
  // Open search - no domain restrictions
  const urls = await tavilySearchCore(query, null, 20);
  return urls; // Return all URLs - filtering happens in main loop
}

/** ---------- Policy-biased search variants ---------- */
async function tavilySearchPolicyBiased(fullName: string, term: string): Promise<string[]> {
  const base = term ? `${fullName} ${term}` : fullName;
  const variants = [
    base,
    `${base} implementation`,
    `${base} recent policy`,
    `${base} executive order`,
    `${base} final rule regulation`,
  ];

  const seen = new Set<string>();
  for (const q of variants) {
    if (!budgetOk()) break;
    const got = await tavilySearchFlexible(q, Array.from(ALLOWED_DOMAINS));
    for (const u of got) if (!seen.has(u)) seen.add(u);
  }
  return Array.from(seen);
}

/** ---------- Extraction with fallbacks ---------- */
function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveFinalUrl(url: string, timeoutMs = 4000): Promise<string> {
  try {
    const r = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, timeoutMs);
    return r.url || url;
  } catch {
    return url;
  }
}

async function tavilyExtractSafe(url: string): Promise<string> {
  if (!budgetOk()) return "";

  // Resolve redirects early and block if landing on a blocked domain.
  const resolvedForHead = await resolveFinalUrl(url);
  if (isBlockedDomain(resolvedForHead)) {
    console.warn("blocked_by_redirect_head", { original: url, final: resolvedForHead });
    return "";
  }

  // 1) Tavily extract
  try {
    const r = await fetchWithTimeout("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, urls: [url], format: "markdown" })
    }, EXTRACT_TIMEOUT_MS);
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      const res = j?.results?.[0] ?? {};
      const resolvedUrl = String(res.url || url);
      if (isBlockedDomain(resolvedUrl)) {
        console.warn("blocked_by_redirect_tavily", { original: url, final: resolvedUrl });
        return "";
      }
      const content =
        (typeof res.markdown === "string" && res.markdown) ||
        (typeof res.content === "string" && res.content) ||
        (typeof res.raw_content === "string" && res.raw_content) || "";
      if (content && content.trim()) return content.length > MAX_LEN ? content.slice(0, MAX_LEN) : content;
    }
  } catch {}

  // 2) Direct HTML (real UA)
  try {
    const r2 = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    }, EXTRACT_TIMEOUT_MS);
    if (r2.ok) {
      const finalUrl = r2.url || url;
      if (isBlockedDomain(finalUrl)) {
        console.warn("blocked_by_redirect_html", { original: url, final: finalUrl });
        return "";
      }
      const html = await r2.text();
      const txt = stripHtml(html);
      if (txt) return txt.length > MAX_LEN ? txt.slice(0, MAX_LEN) : txt;
    }
  } catch {}

  // 3) Jina reader proxy
  try {
    const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
    const r3 = await fetchWithTimeout(proxied, {}, EXTRACT_TIMEOUT_MS);
    if (r3.ok) {
      const txt = await r3.text();
      if (txt) return txt.length > MAX_LEN ? txt.slice(0, MAX_LEN) : txt;
    }
  } catch {}

  return "";
}

/** ---------- tiny pool to limit concurrency ---------- */
async function runPool<T>(limit: number, tasks: (() => Promise<T>)[]): Promise<T[]> {
  const out: T[] = new Array(tasks.length) as T[];
  let i = 0;
  const next = async (): Promise<void> => {
    const cur = i++;
    if (cur >= tasks.length) return;
    if (!budgetOk()) { /* @ts-ignore */ out[cur] = null; return; }
    try { out[cur] = await tasks[cur](); }
    catch { /* @ts-ignore */ out[cur] = null; }
    return next();
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => next()));
  return out;
}

/** ======= main handler ======= */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "use_post" }), {
        status: 405, headers: { "Content-Type": "application/json" }
      });
    }

    // Clone BEFORE any reader consumes the body
    const reqForId = req.clone();
    const reqForTerms = req.clone();

    // Friendly 400 on bad id
    let pplId: number;
    try { pplId = await readId(reqForId); }
    catch {
      return new Response(JSON.stringify({ error: "bad_request_id", hint: "Provide id via JSON body, ?id=, or raw numeric body." }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    const terms = await readTerms(reqForTerms);

    // Load person (name)
    const { data: person, error: pErr } = await supabase
      .from("ppl_index")
      .select("id, name")
      .eq("id", pplId)
      .single();
    if (pErr || !person) {
      return new Response(JSON.stringify({ error: "ppl_index row not found" }), {
        status: 404, headers: { "Content-Type": "application/json" }
      });
    }
    const fullName: string = person.name;

    const prefix = `ppl/${pplId}/`;
    const stored: Array<{ term: string; domain: string; url: string; storageKey: string; length: number }> = [];
    const skipped: Array<{ term: string; domain?: string; reason: string }> = [];
    const createdWebIds: number[] = [];
    const llmVerdicts: any[] = [];

    // For each term
    for (const rawTerm of terms) {
      if (!budgetOk()) break;
      const slug = slugifyTerm(rawTerm);

      // Search (policy-biased variants + two-pass allowlist fallback)
      let urls: string[] = [];
      try {
        urls = await tavilySearchPolicyBiased(fullName, rawTerm);
      } catch (e) {
        skipped.push({ term: slug, reason: `search failed: ${String(e)}` });
        continue;
      }
      if (!urls.length) {
        skipped.push({ term: slug, reason: "no eligible results for allowed domains" });
        continue;
      }

      // Dedupe + rank
      const seenUrls = new Set<string>();
      const deduped = urls.filter((u) => (seenUrls.has(u) ? false : (seenUrls.add(u), true)));
      const ranked = rankUrlsByFreshness(deduped);

      // Categorize: blocked, allowed, unknown
      const categorized: Array<{ url: string; domain: string; category: "allowed" | "unknown" }> = [];
      
      for (const u of ranked) {
        // Skip blocked
        if (isBlockedDomain(u)) continue;
        
        const d = matchAllowedDomain(u);
        if (d) {
          categorized.push({ url: u, domain: d, category: "allowed" });
        } else {
          const host = (() => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })();
          categorized.push({ url: u, domain: host, category: "unknown" });
        }
      }

      // Selection: prioritize allowed domains, then unknowns
      const selected: Array<{ domain: string; url: string; category: "allowed" | "unknown" }> = [];
      const usedDomains = new Set<string>();
      
      // First add allowed domains (diversify)
      for (const item of categorized.filter(x => x.category === "allowed")) {
        if (!usedDomains.has(item.domain)) {
          selected.push(item);
          usedDomains.add(item.domain);
          if (selected.length >= PER_TERM_TARGET) break;
        }
      }
      
      // Then fill with unknowns
      if (selected.length < PER_TERM_TARGET) {
        for (const item of categorized.filter(x => x.category === "unknown")) {
          selected.push(item);
          if (selected.length >= PER_TERM_TARGET) break;
        }
      }
      
      // Finally fill remaining with more from allowed
      if (selected.length < PER_TERM_TARGET) {
        for (const item of categorized.filter(x => x.category === "allowed")) {
          if (selected.some(s => s.url === item.url)) continue;
          selected.push(item);
          if (selected.length >= PER_TERM_TARGET) break;
        }
      }
      
      if (!selected.length) {
        skipped.push({ term: slug, reason: "no post-filtered results" });
        continue;
      }

      // Build limited concurrency tasks for extraction + storage
      const nowIsoStr = new Date().toISOString();
      const tasks = selected.map(({ domain, url, category }) => async () => {
        if (!budgetOk()) return null as any;
        try {
          const text = await tavilyExtractSafe(url);
          if (!text) {
            skipped.push({ term: slug, domain, reason: "extract empty" });
            return null as any;
          }

          // If allowed, pass through. If unknown, run LLM judge
          if (category === "unknown") {
            const snippet = text.slice(0, 4000);
            const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return domain; } })();
            const verdict = await _mistralJudgeSmall({
              meta: { url, host, title: undefined, detected_date: null, lang: null },
              snippet,
              person: fullName,
              topic: rawTerm,
              nowIso: nowIsoStr
            });
            
            if (!verdict) {
              llmVerdicts.push({ url, host, status: "llm_error" });
              skipped.push({ term: slug, domain, reason: "llm_error" });
              return null as any;
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
              llmVerdicts.push({
                url,
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
              skipped.push({ term: slug, domain, reason: `llm_rejected: ${rejectReason}` });
              return null as any;
            }
            
            llmVerdicts.push({
              url,
              host,
              status: "accepted",
              score: verdict.score,
              institution: verdict.institution
            });
          }

          const label = bareDomainLabelFromUrl(url);
          const parts = text.length > PART_LEN ? splitIntoParts(text, PART_LEN) : [text];

          // insert web_content (unused/false so later steps can mark used)
          const { data: ins, error: insErr } = await supabase
            .from("web_content")
            .insert({ path: "", owner_id: pplId, is_ppl: true, link: url, used: false })
            .select("id")
            .single();
          if (insErr || !ins) throw insErr || new Error("web_content insert failed");
          const wcId = ins.id as number;
          createdWebIds.push(wcId);

          // Store parts
          for (let i = 0; i < parts.length; i++) {
            if (!budgetOk()) break;
            const partSuffix = parts.length > 1 ? `.${i + 1}` : "";
            const key = `${prefix}${slug}.${wcId}.${label}${partSuffix}.txt`;
            await putToStorage(key, parts[i]);

            // update path on first part
            if (i === 0) {
              const { error: updErr } = await supabase.from("web_content").update({ path: key }).eq("id", wcId);
              if (updErr) console.warn("web_content path update failed:", wcId, updErr);
            }

            stored.push({ term: slug, domain, url, storageKey: key, length: parts[i].length });
          }

          return true as any;
        } catch (e) {
          console.warn("extract/store skipped:", slug, domain, url, e);
          skipped.push({ term: slug, domain, reason: "extract/store failed" });
          return null as any;
        }
      });

      await runPool(POOL_LIMIT, tasks);
    }

    // Soft-fail: return 200 even if nothing stored (with stop_reason)
    if (stored.length === 0) {
      return new Response(JSON.stringify({
        id: pplId,
        name: fullName,
        terms: terms.map(slugifyTerm),
        web_ids: [],
        stored,
        skipped,
        stop_reason: budgetOk() ? "no_sources" : "budget_exhausted"
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Success
    return new Response(JSON.stringify({
      id: pplId,
      name: fullName,
      terms: terms.map(slugifyTerm),
      web_ids: createdWebIds,
      stored,
      skipped,
      llm_verdicts: llmVerdicts,
      stop_reason: budgetOk() ? "completed_within_budget" : "budget_exhausted",
      time_ms: Date.now() - startTime,
      notes:
        "Round-2: Open Tavily search; post-filtered (blocked→reject, allowed→accept, unknown→LLM judge). LLM enforces recency≤12mo, excludes press releases/opinions/news clips, blocks partisan content. Score threshold ≥7.0. Policy-biased queries; freshness ranking enabled."
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(err);
    const msg = String(err?.message || err || "unknown error");
    const status = msg === "bad_request_id" ? 400 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { "Content-Type": "application/json" }
    });
  }
});
