/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ======= config ======= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;
const MISTRAL_MEDIUM = "mistral-small-latest";

const SEARCH_TIMEOUT_MS = 8_000;
const EXTRACT_TIMEOUT_MS = 12_000;
const MAX_PAGE_CHARS = 110_000; // match ppl_round1 CHUNK_LEN
const MAX_NAMES = 20;
const TOP_URLS = 3;

/** Allowed domains (copied from ppl_round1) */
const ALLOWED_DOMAINS = [
  "a46.asmdc.org","aaas.org","abc.net.au","abcnews.go.com","acenet.edu","afp.com",
  "ajmc.com","apnews.com","arizonamirror.com","assemblee-nationale.fr","axios.com","ballotpedia.org",
  "ballotready.org","bankofengland.co.uk","bbc.com","bea.gov","beverlyhills.org","bioguide.congress.gov",
  "bipartisanpolicy.org","bjs.ojp.gov","bls.gov","boe.es","britannica.com","bts.gov",
  "budget.house.gov","budgetmodel.wharton.upenn.edu","bundesbank.de","bundesrat.de","bundesregierung.de","bundestag.de",
  "bundesverfassungsgericht.de","c-span.org","caimmigrant.org","californiahealthline.org","calmatters.org","camera.it",
  "canada.ca","capitol.texas.gov","carnegieendowment.org","carnegieeurope.eu","cbc.ca","cbo.gov",
  "ccltss.org","cdc.gov","cdt.org","cdflaborlaw.com","cdph.ca.gov","census.gov",
  "cfr.org","chathamhouse.org","cityofchicago.org","climate.law.columbia.edu","commonwealthfund.org","comptroller.texas.gov",
  "congress.gov","constitutioncenter.org","consumerfinance.gov","courtlistener.com","crfb.org","csg.org",
  "csis.org","csmonitor.com","ctmirror.org","curia.europa.eu","data.ca.gov","data.cityofnewyork.us",
  "data.gov","data.ny.gov","data.texas.gov","dataverse.harvard.edu","dhs.gov","documentcloud.org",
  "dos.myflorida.com","dot.gov","dre.pt","dw.com","eac.gov","ecb.europa.eu",
  "ecfr.gov","echr.coe.int","econofact.org","ed.gov","edsource.org","edstrategy.org",
  "eeas.europa.eu","eff.org","eia.gov","electionlab.mit.edu","electionline.org","elections.ca",
  "elections.ny.gov","electionstudies.org","electoralcommission.org.uk","electproject.org","energy.gov","epa.gov",
  "eur-lex.europa.eu","europa.eu","factcheck.org","fairvote.org","fbi.gov","fcc.gov",
  "fda.gov","fec.gov","federalregister.gov","federalreserve.gov","finra.org","flsenate.gov",
  "foley.com","followthemoney.org","france24.com","ftc.gov","gallup.com","gao.gov",
  "gazette.gc.ca","gazzettaufficiale.it","globalinitiative.net","gothamist.com","gov.ca.gov","gov.uk",
  "gouvernement.fr","governor.ny.gov","govinfo.gov","govtrack.us","gpo.gov","gsa.gov",
  "harvard.edu","hhs.gov","hklaw.com","house.gov","hud.gov","humanrightsmeasurement.org",
  "icc-cpi.int","icj-cij.org","icpsr.umich.edu","ifs.org.uk","ilga.gov","imf.org",
  "insidehighered.com","irs.gov","jec.senate.gov","justice.gc.ca","justice.gov","justsecurity.org",
  "kansasreflector.com","kff.org","laist.com","latimes.com","law.berkeley.edu","law.cornell.edu",
  "leg.colorado.gov","leg.wa.gov","legislation.gov.uk","leginfo.legislature.ca.gov","legis.state.pa.us","loc.gov",
  "malegislature.gov","manchesterdemocracy.org","mass.gov","maynardnexsen.com","michiganadvance.com","millercenter.org",
  "minnpost.com","morningconsult.com","myfloridahouse.gov","naco.org","nap.edu","nasaa.org",
  "nass.org","nato.int","nber.org","nbcbayarea.com","nces.ed.gov","ncsc.org",
  "ncsl.org","nga.org","nhk.or.jp","nhtsa.gov","nih.gov","noaa.gov",
  "npr.org","nyc.gov","nycbar.org","nycourts.gov","oag.ca.gov","occrp.org",
  "oecd.org","ohchr.org","oig.justice.gov","oireachtas.ie","ojp.gov","opec.org",
  "opensecrets.org","openstates.org","osce.org","ourcommons.ca","ourworldindata.org","oversight.gov",
  "oyez.org","parl.ca","parlamento.pt","parliament.uk","pbs.org","pewresearch.org",
  "pgpf.org","phila.gov","politico.com","politifact.com","ppic.org","presidency.ucsb.edu",
  "propublica.org","prri.org","psea.org","publicagenda.org","publichealth.berkeley.edu","publications.gc.ca",
  "pwc.com","rand.org","randstatestats.org","regents.universityofcalifornia.edu","reginfo.gov","reporterslab.org",
  "resolutionfoundation.org","reuters.com","rferl.org","rfi.fr","rte.ie","saisreview.sais.jhu.edu",
  "santamariatimes.com","sba.gov","sbs.com.au","scholars.org","scite.ai","sec.gov",
  "senat.fr","senate.gov","senato.it","sencanada.ca","siepr.stanford.edu","sipri.org",
  "snopes.com","sos.ca.gov","sos.state.oh.us","sos.texas.gov","sos.wa.gov","sph.emory.edu",
  "ssa.gov","stateline.org","stinson.com","stlouisfed.org","supremecourt.gov","taxfoundation.org",
  "taxpolicycenter.org","techpolicy.press","thebureauinvestigates.com","theguardian.com","theharrispoll.com","thehill.com",
  "themarkup.org","thetrace.org","tsinghua.edu.cn","treasury.gov","ucla.edu","umn.edu",
  "un.org","urban.org","usa.gov","usafacts.org","usaspending.gov","usatoday.com",
  "uscourts.gov","usda.gov","usgs.gov","usitc.gov","usmayors.org","uww.universityofcalifornia.edu",
  "verfassungsblog.de","votesmart.org","voteview.com","wisconsinwatch.org","worldbank.org","yougov.com",
  "americorps.gov","cepr.org","nyccfb.info","cnbc.com","english.elpais.com","crainsnewyork.com",
  "cityandstateny.com","vitalcitynyc.org","thecity.nyc","gov.texas.gov","open.texas.gov","natlawreview.com",
  "cliniclegal.org","shrm.org","azcleanelections.gov","texastribune.org","tpr.org","kut.org",
  "houstonpublicmedia.org","keranews.org","elpasomatters.org","19thnews.org","citylimits.org","marylandmatters.org",
  "governor.maryland.gov","priorities.maryland.gov","nbcwashington.com","hstoday.us","euronews.com","apmresearchlab.org",
  "econbrowser.com","econfocus.org","econpolicyjournal.org","econpolicyinstitute.org","federalreservehistory.org","federalreserveeducation.org",
  "dallasfed.org","clevelandfed.org","newyorkfed.org","philadelphiafed.org","kansascityfed.org","richmondfed.org",
  "minneapolisfed.org","nationalacademies.org","science.org","nature.com"
] as const;

const EXTRACTION_DENYLIST = new Set<string>(["thehill.com", "bloomberg.com", "urban.org"]);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

function fetchWithTimeout(input: RequestInfo, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function normalizedHost(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function matchAllowedDomain(u: string): string | null {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    if (EXTRACTION_DENYLIST.has(host)) return null;
    return (ALLOWED_DOMAINS as readonly string[]).includes(host) ? host : null;
  } catch {
    return null;
  }
}

function isBlockedDomain(url: string): boolean {
  try {
    const host = normalizedHost(url);
    if (!host) return false;
    const fullUrl = url.toLowerCase();
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
      "focusonthefamily.com","hrc.org","glaad.org","plannedparenthoodaction.org",
      "prochoiceamerica.org","nrlc.org","democracydocket.com","populardemocracy.org",
      "foxnews.com","msnbc.com","newsmax.com","oann.com","pjmedia.com",
      "slate.com","motherjones.com","breitbart.com","theepochtimes.com",
      "thegatewaypundit.com",
      "linkedin.com","wikipedia.org","en.wikipedia.org","texastribune.org",
      "x.com","twitter.com","instagram.com","facebook.com","youtube.com"
    ];
    if (blockedDomains.includes(host)) return true;
    if (/^(.*\.)?democrats\.senate\.gov$/.test(host)) return true;
    if (/^(.*\.)?republican(s)?\.senate\.gov$/.test(host)) return true;
    if (/^(.*\.)?(speaker|majorityleader|minorityleader)\.gov$/.test(host)) return true;
    if (/^(.*\.)?[a-z-]+\.house\.gov$/.test(host) && (fullUrl.includes("republicans") || fullUrl.includes("democrats"))) return true;
    if (/^(.*\.)?[a-z0-9-]+\.house\.gov$/.test(host)) return true;
    if (/^(.*\.)?[a-z0-9-]+\.senate\.gov$/.test(host)) return true;
    if (/^(.*\.)?((democrats|gop|rnc|dnc|dscc|nrsc|dccc|nrcc|dlcc|rga|dga))\.org$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

const REDIRECT_PARAM_KEYS = new Set([
  "redirect","redirect_url","redirect_uri","url","u","target","dest","destination",
  "next","continue","return","return_url","link","out","goto"
]);

function tryDecodeToAbsoluteUrl(val: string, maxDecodes = 5): string | null {
  let current = String(val).trim();
  for (let i = 0; i < maxDecodes; i++) {
    if (/^https?:\/\//i.test(current)) return current;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next.trim();
    } catch {
      return null;
    }
  }
  return /^https?:\/\//i.test(current) ? current : null;
}

function extractEmbeddedUrls(url: string): string[] {
  const out: string[] = [];
  try {
    const parsed = new URL(url);
    for (const [k, v] of parsed.searchParams) {
      if (v && REDIRECT_PARAM_KEYS.has(k.toLowerCase())) {
        const abs = tryDecodeToAbsoluteUrl(v);
        if (abs) out.push(abs);
      }
    }
  } catch {}
  return out;
}

function isBlockedDomainDeep(url: string, depth = 0, maxDepth = 3): boolean {
  if (depth > maxDepth) return isBlockedDomain(url);
  if (isBlockedDomain(url)) return true;
  for (const emb of extractEmbeddedUrls(url)) {
    if (isBlockedDomainDeep(emb, depth + 1, maxDepth)) return true;
  }
  return false;
}

function unwrapLikelyRedirectUrl(url: string, depth = 0, maxDepth = 3): string {
  if (depth >= maxDepth) return url;
  const embedded = extractEmbeddedUrls(url);
  const first = embedded[0];
  if (first) return unwrapLikelyRedirectUrl(first, depth + 1, maxDepth);
  return url;
}

async function resolveFinalUrl(url: string, timeoutMs = 4000): Promise<string> {
  try {
    const r = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, timeoutMs);
    let finalUrl = r?.url || url;
    if (!r?.url) {
      const r2 = await fetchWithTimeout(url, { method: "GET", redirect: "follow", headers: { "Range": "bytes=0-0" } }, timeoutMs);
      finalUrl = r2?.url || url;
    }
    return finalUrl;
  } catch {
    return url;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPageText(url: string): Promise<string> {
  const u2 = unwrapLikelyRedirectUrl(url);
  if (isBlockedDomainDeep(u2)) return "";

  const resolved = await resolveFinalUrl(u2);
  if (isBlockedDomainDeep(resolved)) return "";

  try {
    const r = await fetchWithTimeout("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, urls: [u2], format: "markdown" })
    }, EXTRACT_TIMEOUT_MS);
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      const res = j?.results?.[0] ?? {};
      const out = res.markdown || res.content || res.raw_content || "";
      if (out?.trim()) return out.length > MAX_PAGE_CHARS ? out.slice(0, MAX_PAGE_CHARS) : out;
    }
  } catch {}

  try {
    const r = await fetchWithTimeout("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, urls: [u2], format: "text" })
    }, EXTRACT_TIMEOUT_MS);
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      const res = j?.results?.[0] ?? {};
      const out = res.content || res.raw_content || "";
      if (out?.trim()) return out.length > MAX_PAGE_CHARS ? out.slice(0, MAX_PAGE_CHARS) : out;
    }
  } catch {}

  try {
    const r2 = await fetchWithTimeout(u2, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }
    }, EXTRACT_TIMEOUT_MS);
    if (r2?.ok) {
      const html = await r2.text();
      const txt = stripHtml(html);
      if (txt) return txt.length > MAX_PAGE_CHARS ? txt.slice(0, MAX_PAGE_CHARS) : txt;
    }
  } catch {}

  return "";
}

async function tavilySearch(query: string, maxResults: number): Promise<string[]> {
  const body = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: maxResults,
    include_answer: false
  };
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

/** Extract politician names from text (full_card_gen style), resolve to ppl_index, exclude ownerId, cap at MAX_NAMES */
async function extractAffiliateNames(
  combinedText: string,
  ownerId: number,
  ownerName: string
): Promise<string[]> {
  const sys = `You extract U.S. politician names from source text. Return ONLY valid JSON.
Rules:
- Output shape: {"names": ["Full Name One", "Full Name Two"]}
- Include only politicians mentioned in a contextually relevant way. Exclude incidental references.
- Return full names. If the text asks you to exclude a specific person, do not include them.
- If no relevant politician names are found, return {"names": []}.`;

  const user = `From the following text, extract the full names of U.S. politicians (members of Congress, senators, cabinet officials, etc.) mentioned in a contextually relevant way.
- Exclude: ${ownerName} (the profile owner).

Return JSON: {"names": ["Name One", "Name Two"]} or {"names": []}.

Text:
"""${combinedText.slice(0, 120000)}"""`;

  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: MISTRAL_MEDIUM,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`Mistral error ${r.status}`);
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { names?: string[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {}
    const rawNames: string[] = Array.isArray(parsed?.names) ? parsed.names : [];
    if (rawNames.length === 0) return [];

    const seenIds = new Set<number>();
    const canonicalNames: string[] = [];

    for (const rawName of rawNames) {
      if (canonicalNames.length >= MAX_NAMES) break;
      const name = String(rawName ?? "").trim();
      if (!name) continue;
      try {
        const { data } = await supabase
          .from("ppl_index")
          .select("id, name, limit_score")
          .or(`name.ilike.%${name}%,sub_name.ilike.%${name}%`)
          .order("limit_score", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id != null && data.id !== ownerId && !seenIds.has(Number(data.id))) {
          seenIds.add(Number(data.id));
          canonicalNames.push(String(data.name ?? "").trim() || name);
        } else if (!data?.id) {
          const tokens = name.split(/\s+/).filter(Boolean);
          const lastName = tokens[tokens.length - 1];
          if (lastName) {
            const { data: fb } = await supabase
              .from("ppl_index")
              .select("id, name, limit_score")
              .or(`name.ilike.%${lastName}%,sub_name.ilike.%${lastName}%`)
              .order("limit_score", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (fb?.id != null && fb.id !== ownerId && !seenIds.has(Number(fb.id))) {
              seenIds.add(Number(fb.id));
              canonicalNames.push(String(fb.name ?? "").trim() || name);
            }
          }
        }
      } catch {
        // skip
      }
    }
    return canonicalNames;
  } catch (e) {
    console.warn("extractAffiliateNames failed:", e);
    return [];
  }
}

async function readId(req: Request): Promise<number> {
  const url = new URL(req.url);
  const qId = url.searchParams.get("id");
  if (qId && /^\d+$/.test(qId)) return Number(qId);
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (j && typeof j.id === "number") return j.id;
    if (j && typeof j.id === "string" && /^\d+$/.test(j.id)) return Number(j.id);
  } else {
    const raw = await req.text().catch(() => "");
    if (raw && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  }
  throw new Error("bad_request_id");
}

Deno.serve(async (req) => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: corsHeaders });
    }

    let pplId: number;
    try {
      pplId = await readId(req);
    } catch {
      return new Response(JSON.stringify({ error: "bad_request_id", hint: "Provide id in JSON body or ?id=" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const { data: person, error: pErr } = await supabase
      .from("ppl_index")
      .select("id, name")
      .eq("id", pplId)
      .single();
    if (pErr || !person) {
      return new Response(JSON.stringify({ error: "ppl_index not found" }), { status: 404, headers: corsHeaders });
    }
    const fullName: string = String(person.name ?? "").trim();
    if (!fullName) {
      await supabase.from("ppl_index").update({ affiliates: "fail" }).eq("id", pplId);
      return new Response(JSON.stringify({ ok: false, reason: "no_name" }), { headers: corsHeaders });
    }

    const query = `${fullName} affiliates`;
    let urls = await tavilySearch(query, 20);
    const seen = new Set<string>();
    urls = urls.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));

    const allowed: Array<{ url: string; domain: string }> = [];
    const usedDomains = new Set<string>();
    for (const u of urls) {
      const u2 = unwrapLikelyRedirectUrl(u);
      if (isBlockedDomainDeep(u2)) continue;
      const d = matchAllowedDomain(u2);
      if (d && !usedDomains.has(d)) {
        allowed.push({ url: u2, domain: d });
        usedDomains.add(d);
        if (allowed.length >= TOP_URLS) break;
      }
    }

    if (allowed.length === 0) {
      await supabase.from("ppl_index").update({ related: null, affiliates: "fail" }).eq("id", pplId);
      return new Response(JSON.stringify({ ok: false, reason: "no_allowed_urls" }), { headers: corsHeaders });
    }

    const texts: string[] = [];
    for (const { url } of allowed) {
      const t = await extractPageText(url);
      if (t) texts.push(t);
    }
    const combined = texts.join("\n\n");
    if (!combined.trim()) {
      await supabase.from("ppl_index").update({ related: null, affiliates: "fail" }).eq("id", pplId);
      return new Response(JSON.stringify({ ok: false, reason: "no_scraped_content" }), { headers: corsHeaders });
    }

    const names = await extractAffiliateNames(combined, pplId, fullName);
    const relatedValue = names.length > 0 ? names.join(", ") : null;
    const affiliatesStatus = names.length > 0 ? "available" : "fail";

    const { error: updErr } = await supabase
      .from("ppl_index")
      .update({ related: relatedValue, affiliates: affiliatesStatus })
      .eq("id", pplId);

    if (updErr) {
      await supabase.from("ppl_index").update({ affiliates: "fail" }).eq("id", pplId);
      return new Response(JSON.stringify({ ok: false, reason: "db_update_failed" }), { status: 500, headers: corsHeaders });
    }

    if (names.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_affiliates_found", affiliates: "fail", related: null, count: 0 }),
        { headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        affiliates: "available",
        related: relatedValue,
        count: names.length
      }),
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("ppl_affiliates error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } }
    );
  }
});
