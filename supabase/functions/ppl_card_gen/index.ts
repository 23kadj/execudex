/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ======= config ======= */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEB_BUCKET     = Deno.env.get("WEB_BUCKET") || "web";
const MISTRAL_API_KEY= Deno.env.get("MISTRAL_API_KEY");

const MAX_LEN = Number.POSITIVE_INFINITY;
const MEDIUM_CUTOFF  = 110_000;       // <= this => mistral-small; > this => mistral-large
const MISTRAL_MEDIUM = "mistral-small-latest";
const MISTRAL_LARGE  = "mistral-large-latest";
const MISTRAL_TIMEOUT_MS = 180_000;   // increased timeout to 180s
const MISTRAL_TEMPERATURE = 0.1;      // lowered temperature for faster responses

/** Concurrency (process multiple pages at a time) */
const CONCURRENCY = Number(Deno.env.get("CONCURRENCY") || 25); // configurable via env, set to 25

/** Evidence requirement (kept) */
const REQUIRE_EVIDENCE_DEFAULT = true;
const REQUIRE_EVIDENCE_METRICS = false; // metrics pages often paraphrase/short

/** ======= CATEGORY / SCREEN POLICY =======
 * One category set per screen, shared by every tier -- the client shows the same
 * 6-category + "More Selections" grid regardless of hard/soft/base, so a card can
 * never be generated with a category the profile's own pages have no button for.
 */
const AGENDA_CATS     = new Set(["economy","immigration","healthcare","environment","defense","education","more"]);
const IDENTITY_CATS   = new Set(["background","career","public image","accomplishments","statements","awards","more"]);
const AFFILIATES_CATS = new Set(["party","organizations","businesses","politicians","medias","donors","more"]);

/** Retired/legacy category values (either from the old reduced soft/base set, or
 * search-sourcing topics upstream in ppl_round2 that were never standalone
 * categories) -- fold them into their nearest real category before any set
 * membership check runs, so old data and any stray LLM output both still land. */
const CATEGORY_ALIASES: Record<string, string> = {
  "social programs": "economy",
  "national security": "defense",
  "beliefs": "public image",
  "enterprises": "businesses",
};
function resolveCategoryAlias(c: string): string {
  return CATEGORY_ALIASES[c] || c;
}

/** For is_media tagging (unchanged) */
const IS_MEDIA_DOMAINS = new Set<string>([
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "thehill.com",
  "bloomberg.com",
  "axios.com",
  "afp.com",
  "dw.com",
  "cbc.ca",
  "abc.net.au",
  "snopes.com",
  "politifact.com",
  "fivethirtyeight.com",
  "yougov.com",
  "morningconsult.com",
  "gallup.com"
]);

/** ======= supabase client ======= */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ---------- helpers ---------- */
function hostFromUrl(u: string): string | null {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}
function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function trimToWords(s: string, maxWords: number) {
  const words = String(s || "").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}
function wordCount(s: string) {
  return String(s || "").trim().split(/\s+/).filter(Boolean).length;
}

/** Memoization for string operations */
const memoTrimToWords = new Map<string, string>();
const memoWordCount = new Map<string, number>();
function memoizedTrimToWords(s: string, maxWords: number): string {
  const key = `${s}::${maxWords}`;
  if (!memoTrimToWords.has(key)) {
    memoTrimToWords.set(key, trimToWords(s, maxWords));
  }
  return memoTrimToWords.get(key)!;
}
function memoizedWordCount(s: string): number {
  if (!memoWordCount.has(s)) {
    memoWordCount.set(s, wordCount(s));
  }
  return memoWordCount.get(s)!;
}

/** Length normalization (no longer a rejection gate) */
function normalizeLengths(titleIn: string, subIn: string) {
  const title = memoizedTrimToWords(titleIn, 10);
  const sub   = memoizedTrimToWords(subIn, 20);
  const tw = memoizedWordCount(title);
  const sw = memoizedWordCount(sub);
  const okStrict  = (tw >= 4 && tw <= 12) && (sw >= 12 && sw <= 26);
  const okRelaxed = (tw >= 3) && (sw >= 10);
  return { title, subtext: sub, okStrict, okRelaxed };
}

/** --- Screen/category mapping & enforcement ---
 * Returns a pair { screen, category } with:
 *  - screen: agenda | identity | affiliates
 *  - category: coerced into the (tier-independent) allowed set for that screen
 */
/** Legacy keyword guess, used only when neither the LLM's own "screen" field nor a
 * caller-supplied screen hint is usable (e.g. old callers that never pass screen). */
function inferScreenByKeyword(c: string): "agenda" | "identity" | "affiliates" {
  if (/econom|social program|immigration|national security|healthcare|environment|defense|education/.test(c)) return "agenda";
  if (/background|career|public image|belief|accomplishment|statement|award/.test(c)) return "identity";
  if (/party|politician|enterprise|organization|business|media|donor/.test(c)) return "affiliates";
  return "agenda";
}

const SCREEN_SETS = { agenda: AGENDA_CATS, identity: IDENTITY_CATS, affiliates: AFFILIATES_CATS };

/**
 * rawScreen/rawCategory come straight from the LLM (two separate fields now,
 * see extractCardsFromPage). knownScreen is the screen the client actually
 * triggered generation for (agenda/identity/affiliates), when available.
 * tierIn is unused for category policy now (every tier shares one category set,
 * matching the client's unified grid) but is kept as a param for call-site stability.
 */
function classifyScreenByTier(
  rawCategory: string,
  _tierIn: string,
  rawScreen?: string,
  knownScreen?: "agenda" | "identity" | "affiliates"
) {
  const c = resolveCategoryAlias(String(rawCategory || "").toLowerCase().trim());

  // Step 1: trust the LLM's own screen+category pair if it's internally consistent.
  const s0 = String(rawScreen || "").toLowerCase().trim() as "agenda" | "identity" | "affiliates";
  if ((s0 === "agenda" || s0 === "identity" || s0 === "affiliates") && SCREEN_SETS[s0].has(c)) {
    return { screen: s0, category: c };
  }

  // Step 2: the category alone might still be a valid, unambiguous leaf value even if
  // the screen field was garbled -- each leaf category belongs to exactly one screen.
  for (const s of ["agenda", "identity", "affiliates"] as const) {
    if (SCREEN_SETS[s].has(c)) return { screen: s, category: c };
  }

  // Step 3: neither field matched anything real -- fall back to the screen the client
  // actually asked for, or a keyword guess, with "more" (every tier's grid has a
  // More Selections button now, so this is always a valid landing spot).
  const s = knownScreen || inferScreenByKeyword(c);
  return { screen: s, category: "more" };
}

/** Build the "allowed categories" object for prompt display (LLM guidance) --
 * same set for every tier now, matching the client's unified category grid. */
function allowedCatsForTier(_tierIn: string) {
  return {
    agenda:     Array.from(AGENDA_CATS),
    identity:   Array.from(IDENTITY_CATS),
    affiliates: Array.from(AFFILIATES_CATS),
  };
}

type KnownScreen = "agenda" | "identity" | "affiliates";
function normalizeScreenHint(v: unknown): KnownScreen | undefined {
  const s = String(v || "").toLowerCase().trim();
  return s === "agenda" || s === "identity" || s === "affiliates" ? s : undefined;
}

/** Read inputs: id (required) + optional web_ids (JSON array or CSV query) + optional screen hint */
async function readInput(req: Request): Promise<{ id: number; web_ids: number[] | null; screen: KnownScreen | undefined; }> {
  const url = new URL(req.url);
  let id: number | null = null;
  let webIds: number[] | null = null;
  let screen: KnownScreen | undefined = normalizeScreenHint(url.searchParams.get("screen"));

  const qId = url.searchParams.get("id");
  if (qId && /^\d+$/.test(qId)) id = Number(qId);

  const qWeb = url.searchParams.get("web_ids");
  if (qWeb) {
    const parsed = qWeb.split(",").map(s => s.trim()).filter(Boolean).map(n => Number(n)).filter(n => Number.isFinite(n));
    if (parsed.length) webIds = parsed;
  }

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    if (id == null) {
      if (typeof j.id === "number") id = j.id;
      else if (typeof j.id === "string" && /^\d+$/.test(j.id)) id = Number(j.id);
    }
    if (!webIds && Array.isArray(j.web_ids)) {
      const arr = j.web_ids.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n));
      if (arr.length) webIds = arr;
    }
    if (!screen) screen = normalizeScreenHint(j.screen);
  } else if (!id) {
    const raw = await req.text().catch(() => "");
    if (raw && /^\d+$/.test(raw.trim())) id = Number(raw.trim());
  }

  if (!id || !Number.isFinite(id)) {
    throw new Error("Missing or invalid id. Provide as JSON { id }, query ?id=, or raw numeric body.");
  }
  return { id, web_ids: webIds, screen };
}

/** Storage helpers */
async function readFileText(key: string): Promise<string> {
  // Encode by path segment to preserve slashes
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  const url = `${SUPABASE_URL}/storage/v1/object/public/${WEB_BUCKET}/${safeKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`file fetch failed ${r.status}`);
  return await r.text();
}

/** Evidence support checker: does this card's evidence_snippets actually appear
 * (verbatim, or with substantial token overlap) in the source page? Previously
 * also passed anything where the snippet and the page both merely contained a
 * digit somewhere -- true for almost any real page -- which let titles built on
 * snippets that were never actually in the source slip through. */
function evidenceSupported(page: string, snippets: string[]): boolean {
  if (!Array.isArray(snippets) || !snippets.length) return false;
  const txt = String(page || "");
  const tokens = (s: string) => s.toLowerCase().split(/\W+/).filter(Boolean);

  for (const snip of snippets.slice(0, 3)) {
    const s = String(snip || "").trim();
    if (s.length < 10) continue;
    if (txt.includes(s)) return true;

    const a = tokens(s);
    const b = tokens(txt.slice(0, Math.min(txt.length, 300_000)));
    const setB = new Set(b);
    const overlap = a.filter(t => setB.has(t)).length;
    if (overlap / Math.max(1, a.length) >= 0.4) return true;
  }
  return false;
}

function isMetricsPath(p: string) {
  return /metrics\.(txt|md)$/i.test(p || "");
}

/** LLM card extraction */
async function extractCardsFromPage(fullName: string, tier: string, pageText: string, link: string) {
  const allowedCats = allowedCatsForTier(tier);

  const systemPrompt = `
You are a careful political analyst. Given a page about a politician, propose potential "cards".
Return ONLY JSON: {"cards":[{...}]}

Each card MUST include:
- "title": 5–10 words, neutral, specific to the page
- "subtext": 15–20 words, neutral, clear, upper-high-school reading level
- "screen": exactly one of "agenda", "identity", "affiliates" -- which of the three sections below this card belongs to
- "category": exactly one specific value taken from that screen's array below. NEVER return "agenda", "identity", or "affiliates" itself as the category -- those are screen names, not categories. Always drill into the array and pick one of its entries.
- "score": integer 0–100 reflecting importance/popularity/relevance based on THIS page
- "confidence": number 0–1 indicating how confident you are this topic is well-supported by THIS page
- "evidence_snippets": 1–3 short quotes (max ~140 chars each) copied from the page that support the card

Do NOT invent facts. Base all cards only on the given page.
Allowed categories (by screen -- "category" must be one of the array entries, not the screen key):
${JSON.stringify(allowedCats, null, 2)}

Example of a correctly-formed card: {"title": "...", "subtext": "...", "screen": "agenda", "category": "${Array.isArray(allowedCats.agenda) ? allowedCats.agenda[0] : "economy"}", "score": 70, "confidence": 0.8, "evidence_snippets": ["..."]}

IMPORTANT RESTRICTIONS:
- "more" is allowed, but only within the screen it aligns with, and only when the card genuinely doesn't fit any of that screen's specific categories -- prefer a specific category whenever reasonably possible.
- DO NOT create any cards whose primary or main subject is about COVID-19 or is heavily related to the COVID-19 pandemic. These topics are outdated and no longer relevant.
- For sitting politicians (current government officials), if a card describes a promise, claim, or campaign running point that has NOT yet been met with actual enacted policy or concrete action, you MUST briefly note this in BOTH the title and subtext. Use brief, neutral language like "proposes", "pledges", "promises", or "aims to" rather than stating it as established fact. Keep this framing subtle but present—do not overemphasize it, just ensure the reader understands it's a stated intention rather than accomplished fact.
`;

  const userPrompt = `
POLITICIAN: ${fullName}

PAGE LINK (if any): ${link || "N/A"}

NOTES:
- Use neutral wording. Avoid hype or partisan framing.
- Do not quote headlines; use substance from the article/text.
- Prefer distinct topics (avoid near-duplicates).
- Evidence snippets must be copied verbatim from the page text.
`;

  const modelToUse = pageText.length <= MEDIUM_CUTOFF ? MISTRAL_MEDIUM : MISTRAL_LARGE;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort("mistral_timeout"), MISTRAL_TIMEOUT_MS);

  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt }
        ],
        temperature: MISTRAL_TEMPERATURE,
        max_tokens: 5000,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`Mistral error ${r.status}`);
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { cards: [] }; }
    const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
    return cards.map((c: any) => ({
      title: String(c?.title || "").trim(),
      subtext: String(c?.subtext || "").trim(),
      screen: String(c?.screen || "").trim().toLowerCase(),
      category: String(c?.category || "").trim().toLowerCase(),
      score: Number.isFinite(c?.score) ? c.score : null,
      confidence: Number.isFinite(c?.confidence) ? c.confidence : null,
      evidence_snippets: Array.isArray(c?.evidence_snippets) ? c.evidence_snippets.slice(0, 3).map((s: any) => String(s || "")) : [],
    }));
  } finally {
    clearTimeout(t);
  }
}

/** Concurrency runner with backoff retry */
async function runLimited<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  maxRetries: number = 1
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const active = new Set<Promise<void>>();

  async function launch() {
    if (idx >= items.length) return;
    const myIdx = idx++;
    const p = (async () => {
      let attempts = 0;
      while (attempts <= maxRetries) {
        try {
          results[myIdx] = await worker(items[myIdx]);
          return;
        } catch (e) {
          attempts++;
          if (attempts > maxRetries) {
            // @ts-ignore
            results[myIdx] = null as any;
            console.warn("worker failed after retries:", e);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 5000 * attempts)); // backoff 5s, 10s, etc.
        }
      }
    })().finally(() => active.delete(p as any));
    active.add(p as any);
    if (active.size < limit) return launch();
  }

  for (let i = 0; i < Math.min(limit, items.length); i++) {
    await launch();
  }
  while (active.size) {
    await Promise.race(active);
    await launch();
  }
  return results;
}

/** ======= request handler ======= */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // NEW: also accept optional web_ids
    const { id: pplId, web_ids, screen: knownScreen } = await readInput(req);

    const { data: person, error: perr } = await supabase
      .from("ppl_index")
      .select("id, name, tier")
      .eq("id", pplId)
      .single();
    if (perr || !person) {
      return new Response(JSON.stringify({ error: "ppl_index row not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    const fullName: string = person.name;
    const tier: string = String(person.tier || "").toLowerCase(); // "hard" | "soft" | "base"

    // Parallel queries: fetch web_content, existing cards, and sample columns simultaneously
    const [wcResult, existingCardsResult, sampleRowsResult] = await Promise.all([
      // Query 1: Fetch target web_content rows
      Array.isArray(web_ids) && web_ids.length
        ? supabase
            .from("web_content")
            .select("id, path, link, owner_id, is_ppl, used")
            .eq("owner_id", pplId)
            .eq("is_ppl", true)
            .in("id", web_ids)
        : supabase
            .from("web_content")
            .select("id, path, link, owner_id, is_ppl, used")
            .eq("owner_id", pplId)
            .eq("is_ppl", true)
            .or("used.is.null,used.eq.false")
            .order("id", { ascending: true })
            .limit(5),
      // Query 2: Existing slugs to prevent duplicates
      supabase
        .from("card_index")
        .select("slug")
        .eq("owner_id", pplId),
      // Query 3: Discover card_index columns to avoid inserting non-existent fields
      supabase
        .from("card_index")
        .select("*")
        .limit(1)
    ]);

    // Process web_content result
    if (wcResult.error) throw new Error(`web_content query failed: ${JSON.stringify(wcResult.error)}`);
    const wcRows = wcResult.data || [];
    const targets = wcRows.filter((r: any) => r && typeof r.path === "string" && r.path.endsWith(".txt"));

    if (!targets.length) {
      return new Response(JSON.stringify({
        message: "no files available",
        id: pplId,
        requested_web_ids: web_ids || null
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Process existing cards result
    if (existingCardsResult.error) throw new Error(`card_index query failed: ${JSON.stringify(existingCardsResult.error)}`);
    const existingSlugs = new Set<string>((existingCardsResult.data || []).map((r: any) => String(r.slug || "").toLowerCase()));

    // Process sample columns result
    const SAFE_DEFAULT_COLS = ["owner_id","is_ppl","screen","category","title","subtext","slug","score","is_media","link","is_active","web","web_id","created_at"];
    if (sampleRowsResult.error) console.warn("card_index sample select failed:", sampleRowsResult.error);
    const discoveredCols = Array.isArray(sampleRowsResult.data) && sampleRowsResult.data[0] ? Object.keys(sampleRowsResult.data[0]) : SAFE_DEFAULT_COLS;
    const allowedCols = new Set<string>(discoveredCols);
    function filterToAllowed(o: Record<string, any>) {
      const out: Record<string, any> = {};
      for (const k of Object.keys(o)) if (allowedCols.has(k)) out[k] = o[k];
      return out;
    }

    const claimedSlugs = new Set<string>();

    type WorkerResult = { acceptedRows: any[]; summary: any };

    // Each worker reads its own file then immediately processes it, so a fast
    // file's Mistral call isn't gated behind the slowest file in the batch
    // (previously all reads had to finish before any Mistral call could start).
    const worker = async (row: any): Promise<WorkerResult> => {
      const webId  = row.id as number;
      const webKey = row.path as string;
      const link   = String(row.link || "");
      const isMetrics = isMetricsPath(webKey);

      let text = "";
      try {
        const raw = await readFileText(webKey);
        text = raw.length > 300_000 ? raw.slice(0, 300_000) : raw; // soft cap, same as before
      } catch (e) {
        console.warn("read file failed:", webKey, e);
        text = "";
      }

      const len = text.length;
      if (len <= 0 || !text.trim()) {
        return { acceptedRows: [], summary: { web_id: webId, web: webKey, scanned: false, reason: "empty" } };
      }
      if (len > MAX_LEN) {
        return { acceptedRows: [], summary: { web_id: webId, web: webKey, scanned: false, reason: "too_long" } };
      }

      // Extract cards
      let rawCards: any[] = [];
      try {
        rawCards = await extractCardsFromPage(
          fullName,
          tier,
          text,
          link
        );
      } catch (e) {
        const reason = /mistral_timeout/.test(String(e)) ? "timeout" : "llm_error";
        return { acceptedRows: [], summary: { web_id: webId, web: webKey, scanned: false, reason } };
      }

      if (!rawCards.length) {
        return { acceptedRows: [], summary: { web_id: webId, web: webKey, scanned: true, generated: 0, reason: "no_cards" } };
      }

      // Parallel normalization and evidence check
      const processedCards = await Promise.all(rawCards.map(async (c) => {
        const { title, subtext, okStrict, okRelaxed } = normalizeLengths(c.title, c.subtext);
        const hasEvidence = !REQUIRE_EVIDENCE_DEFAULT ? true : evidenceSupported(text, c.evidence_snippets || []);
        return { ...c, title, subtext, _okStrict: okStrict, _okRelaxed: okRelaxed, _hasEvidence: hasEvidence };
      }));

      // Evidence gate only. No fallback to an unevidenced card when nothing passes --
      // that was letting titles built on snippets never actually in the source page
      // through, which surfaces later as card body text that contradicts its own title.
      const requireEvidence = isMetrics ? REQUIRE_EVIDENCE_METRICS : REQUIRE_EVIDENCE_DEFAULT;
      let filtered = processedCards.filter(c => (requireEvidence ? c._hasEvidence : true));

      // Rank only (no cap)
      filtered.sort((a,b) => (b.confidence ?? 0) - (a.confidence ?? 0) || (b.score ?? 0) - (a.score ?? 0));

      if (!filtered.length) {
        return { acceptedRows: [], summary: { web_id: webId, web: webKey, scanned: true, generated: 0, reason: "filtered_out" } };
      }

      const host = link ? hostFromUrl(link) : null;
      const is_media =
        host ? Array.from(IS_MEDIA_DOMAINS).some((d) => host === d || (host?.endsWith("." + d))) : false;

      const acceptedRows: any[] = [];
      let generated = 0;
      const createdAtISO = new Date().toISOString();

      for (const c of filtered) {
        // Enforce tier-specific category policy; also map agenda -> agenda_ppl for enum
        const mapped   = classifyScreenByTier(c.category, tier, c.screen, knownScreen);
        const screenRaw = mapped.screen;
        const screen    = screenRaw === "agenda" ? "agenda_ppl" : screenRaw;

        const title    = c.title;
        const subtext  = c.subtext;
        const category = mapped.category;
        const score    = c.score;

        const slug = slugify(`${screen}:${category}:${title}`);

        if (existingSlugs.has(slug)) continue;
        if (claimedSlugs.has(slug)) continue;
        claimedSlugs.add(slug);

        const rowFull = {
          owner_id: pplId,
          is_ppl: true,
          screen,
          category,
          title,
          subtext,
          slug,
          score: Number.isFinite(score) ? score : null,
          is_media,
          link: link || null,
          is_active: true,
          web: webKey,
          web_id: webId,
          created_at: createdAtISO
        };
        const rowFiltered = filterToAllowed(rowFull);
        if (!Object.keys(rowFiltered).length) continue;

        acceptedRows.push(rowFiltered);
        generated++;
        existingSlugs.add(slug);
      }

      const summary: any = {
        web_id: webId,
        web: webKey,
        scanned: true,
        generated,
      };
      if (isMetrics) summary.metrics_page = true;

      return { acceptedRows, summary };
    };

    // Process with concurrency
    const results = await runLimited(targets, CONCURRENCY, worker);

    // Aggregate
    const toInsert = results.flatMap((r) => (r ? r.acceptedRows : []));
    const perFileSummary = results.map((r, i) => r ? r.summary : { web_id: targets[i].id, web: targets[i].path, scanned: false, reason: "worker_failed" });

    const processedIds = targets.map((t: any) => t.id);

    if (!toInsert.length) {
      // Mark processed as used = true (fire-and-forget since no cards were created)
      if (processedIds.length) {
        (async () => {
          try {
            await supabase
              .from("web_content")
              .update({ used: true })
              .in("id", processedIds);
          } catch (e) {
            console.warn("failed to mark web_content.used=true:", e);
          }
        })();
      }

      return new Response(
        JSON.stringify({
          id: pplId,
          name: person.name,
          requested_web_ids: web_ids || null,
          processed_web_ids: processedIds,
          inserted: 0,
          files_scanned: perFileSummary.length,
          details: perFileSummary,
          notes: "No new cards generated (filters, timeouts, or empty pages)."
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Batch inserts for large toInsert
    const BATCH_SIZE = 30;
    const insertPromises = [];
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      insertPromises.push(
        supabase
          .from("card_index")
          .insert(batch)
          .select("id, slug")
      );
    }

    const [insertResults, _] = await Promise.all([
      Promise.all(insertPromises),
      processedIds.length
        ? (async () => {
            try {
              return await supabase
                .from("web_content")
                .update({ used: true })
                .in("id", processedIds);
            } catch (e) {
              console.warn("failed to mark web_content.used=true:", e);
              return null;
            }
          })()
        : Promise.resolve(null)
    ]);

    const insertedCount = insertResults.reduce((acc, res) => acc + (res.data?.length || 0), 0);
    if (insertResults.some(res => res.error)) {
      throw new Error(`card_index insert failed: ${JSON.stringify(insertResults.find(res => res.error)?.error)}`);
    }

    // Send notifications to subscribed users (fire-and-forget)
    if (insertedCount > 0 && toInsert.length > 0) {
      (async () => {
        try {
          const profileIdFormatted = `ppl${pplId}`;
          
          // Get all users subscribed to this profile
          const { data: subscriptions } = await supabase
            .from('subs')
            .select('user')
            .eq('profile_id', profileIdFormatted);
          
          if (subscriptions && subscriptions.length > 0) {
            // Filter users with notifications enabled
            const subscribedUserIds = subscriptions.map(sub => sub.user);
            const { data: usersWithNotifications } = await supabase
              .from('users')
              .select('uuid')
              .in('uuid', subscribedUserIds)
              .eq('notifications_enabled', true);
            
            const enabledUserIds = (usersWithNotifications || []).map(u => u.uuid);
            
            if (enabledUserIds.length === 0) {
              console.log(`[ppl_card_gen] No users with notifications enabled for profile ${profileIdFormatted}`);
              return;
            }
            
            // Extract unique category-screen pairs from inserted cards
            const categoryScreenPairs = new Map<string, { category: string; screen: string }>();
            for (const card of toInsert) {
              const category = card.category || '';
              const screen = card.screen || '';
              const key = `${category}:${screen}`;
              if (category && screen && !categoryScreenPairs.has(key)) {
                categoryScreenPairs.set(key, { category, screen });
              }
            }
            
            const uniquePairs = Array.from(categoryScreenPairs.values());
            if (uniquePairs.length > 0) {
              // Map categories to display names
              const categoryMap: Record<string, string> = {
                'economy': 'Economy', 'environment': 'Environment', 'social programs': 'Social Programs',
                'immigration': 'Immigration', 'healthcare': 'Healthcare', 'education': 'Education',
                'defense': 'Defense', 'national security': 'National Security', 'more': 'More Selections',
                'background': 'Background', 'career': 'Career', 'public image': 'Public Image',
                'accomplishments': 'Accomplishments', 'statements': 'Statements', 'awards': 'Awards',
                'beliefs': 'Beliefs', 'party': 'Party', 'organizations': 'Organizations',
                'businesses': 'Businesses', 'politicians': 'Politicians', 'medias': 'Medias',
                'donors': 'Donors', 'enterprises': 'Enterprises'
              };
              const screenMap: Record<string, string> = {
                'agenda_ppl': 'Agenda', 'identity': 'Identity', 'affiliates': 'Affiliates'
              };
              
              const categoryDisplayNames = uniquePairs.map(({ category, screen }) => {
                if (category === 'more') {
                  // For "more" category, just return the screen display name directly (e.g., "Economy", "Environment")
                  return screenMap[screen] || screen;
                }
                return categoryMap[category] || category;
              }).filter(Boolean);
              
              const message = `New cards have been generated for ${person.name}'s profile. The new cards can be found in the categories and pages below`;
              
              // Insert notifications for users with notifications enabled
              const notificationRecords = enabledUserIds.map(userId => ({
                user_id: userId,
                profile_id: profileIdFormatted,
                profile_name: person.name,
                is_ppl: true,
                message: message,
                categories: categoryDisplayNames
              }));
              
              await supabase.from('notifications').insert(notificationRecords);
              console.log(`[ppl_card_gen] Created notifications for ${enabledUserIds.length} users`);
              
              // Send push notifications via Expo API
              const profileTypeText = `${person.name}'s`;
              const title = `New Cards for ${profileTypeText} Profile`;
              const body = `New cards for ${person.name}'s profile have been generated, come check them out!`;
              
              // Fetch push tokens for users with notifications enabled
              const { data: pushTokens } = await supabase
                .from('user_push_tokens')
                .select('push_token, user_id')
                .in('user_id', enabledUserIds);
              
              if (pushTokens && pushTokens.length > 0) {
                // Send push notifications and inspect each ticket so a stale
                // (uninstalled/unregistered) token doesn't fail silently forever.
                const pushResults = await Promise.all(pushTokens.map(async (tokenData) => {
                  const message = {
                    to: tokenData.push_token,
                    sound: 'notification.wav',
                    title: title,
                    body: body,
                    data: { navigateTo: 'notifications' },
                    badge: 1,
                  };
                  try {
                    const res = await fetch('https://exp.host/--/api/v2/push/send', {
                      method: 'POST',
                      headers: {
                        Accept: 'application/json',
                        'Accept-Encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(message),
                    });
                    const json = await res.json().catch(() => null);
                    return { push_token: tokenData.push_token, ticket: json?.data };
                  } catch (e) {
                    console.error('[ppl_card_gen] Push send failed:', e);
                    return { push_token: tokenData.push_token, ticket: null };
                  }
                }));

                const staleTokens = pushResults
                  .filter(r => r.ticket?.status === 'error' && r.ticket?.details?.error === 'DeviceNotRegistered')
                  .map(r => r.push_token);
                if (staleTokens.length > 0) {
                  await supabase.from('user_push_tokens').delete().in('push_token', staleTokens);
                  console.log(`[ppl_card_gen] Pruned ${staleTokens.length} stale push token(s)`);
                }

                console.log(`[ppl_card_gen] Sent ${pushTokens.length} push notifications`);
              }
            }
          }
        } catch (err) {
          console.error('[ppl_card_gen] Error sending notifications:', err);
        }
      })();
    }

    return new Response(
      JSON.stringify({
        id: pplId,
        name: person.name,
        requested_web_ids: web_ids || null,
        processed_web_ids: processedIds,
        inserted: insertedCount,
        files_scanned: perFileSummary.length,
        details: perFileSummary
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    const msg =
      err instanceof Error
        ? err.message
        : (() => { try { return JSON.stringify(err); } catch { return String(err); } })();

    return new Response(JSON.stringify({ error: msg }), {
      status: /Missing or invalid/.test(msg) ? 400 : 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});