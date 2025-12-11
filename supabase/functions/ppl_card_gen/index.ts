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
 * Soft & Base tiers share the same allowed categories.
 * Only HARD tier may use "more", and it must align with the inferred screen.
 */
const HARD_AGENDA       = new Set(["economy","immigration","healthcare","environment","defense","education","more"]);
const HARD_IDENTITY     = new Set(["background","career","public image","accomplishments","statements","awards","more"]);
const HARD_AFFILIATES   = new Set(["party","organizations","businesses","politicians","medias","donors","more"]);

const SOFTBASE_AGENDA     = new Set(["economy","social programs","immigration","national security"]);
const SOFTBASE_IDENTITY   = new Set(["background","career","public image","beliefs"]);
const SOFTBASE_AFFILIATES = new Set(["party","politicians","enterprises","donors"]);

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
 *  - category: coerced into allowed sets per tier & screen
 * Soft/Base: never "more"
 * Hard: "more" allowed, must align with inferred screen
 */
function classifyScreenByTier(rawCategory: string, tierIn: string) {
  const tier = String(tierIn || "").toLowerCase(); // "hard" | "soft" | "base"
  const c = String(rawCategory || "").toLowerCase().trim();

  // helper: infer screen by keyword if category is unknown
  const inferScreen = (): "agenda" | "identity" | "affiliates" => {
    if (/econom|social program|immigration|national security|healthcare|environment|defense|education/.test(c)) return "agenda";
    if (/background|career|public image|belief|accomplishment|statement|award/.test(c)) return "identity";
    if (/party|politician|enterprise|organization|business|media|donor/.test(c)) return "affiliates";
    // default identity if unclear
    return "identity";
  };

  if (tier === "hard") {
    if (HARD_AGENDA.has(c))     return { screen: "agenda",     category: c };
    if (HARD_IDENTITY.has(c))   return { screen: "identity",   category: c };
    if (HARD_AFFILIATES.has(c)) return { screen: "affiliates", category: c };
    // Not matched: assign to inferred screen with category "more"
    const s = inferScreen();
    return { screen: s, category: "more" };
  } else {
    // soft/base: strict allowed sets, no "more"
    if (SOFTBASE_AGENDA.has(c))     return { screen: "agenda",     category: c };
    if (SOFTBASE_IDENTITY.has(c))   return { screen: "identity",   category: c };
    if (SOFTBASE_AFFILIATES.has(c)) return { screen: "affiliates", category: c };

    // Not matched: coerce into an allowed default for the inferred screen
    const s = inferScreen();
    if (s === "agenda")     return { screen: "agenda",     category: "economy" };
    if (s === "affiliates") return { screen: "affiliates", category: "party" };
    return { screen: "identity", category: "background" };
  }
}

/** Build the "allowed categories" object for prompt display (LLM guidance) */
function allowedCatsForTier(tierIn: string) {
  const tier = String(tierIn || "").toLowerCase();
  if (tier === "hard") {
    return {
      agenda:     Array.from(HARD_AGENDA),
      identity:   Array.from(HARD_IDENTITY),
      affiliates: Array.from(HARD_AFFILIATES),
    };
  }
  return {
    agenda:     Array.from(SOFTBASE_AGENDA),
    identity:   Array.from(SOFTBASE_IDENTITY),
    affiliates: Array.from(SOFTBASE_AFFILIATES),
  };
}

/** Read inputs: id (required) + optional web_ids (JSON array or CSV query) */
async function readInput(req: Request): Promise<{ id: number; web_ids: number[] | null; }> {
  const url = new URL(req.url);
  let id: number | null = null;
  let webIds: number[] | null = null;

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
  } else if (!id) {
    const raw = await req.text().catch(() => "");
    if (raw && /^\d+$/.test(raw.trim())) id = Number(raw.trim());
  }

  if (!id || !Number.isFinite(id)) {
    throw new Error("Missing or invalid id. Provide as JSON { id }, query ?id=, or raw numeric body.");
  }
  return { id, web_ids: webIds };
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

/** Very loose evidence support checker */
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

    if (/\d/.test(s) && /\d/.test(txt)) return true;
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
- "category": one of the allowed sets for the tier & screen (see below)
- "score": integer 0–100 reflecting importance/popularity/relevance based on THIS page
- "confidence": number 0–1 indicating how confident you are this topic is well-supported by THIS page
- "evidence_snippets": 1–3 short quotes (max ~140 chars each) copied from the page that support the card

Do NOT invent facts. Base all cards only on the given page.
Allowed categories (by screen):
${JSON.stringify(allowedCats, null, 2)}

IMPORTANT RESTRICTIONS:
- Only HARD tier allows the category "more", and only within the screen it aligns with.
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
      category: String(c?.category || "").trim(),
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
    const { id: pplId, web_ids } = await readInput(req);

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

    // Parallel file reads for small files
    const fileTexts = new Map<number, string>();
    await runLimited(targets, CONCURRENCY, async (row: any) => {
      const webKey = row.path as string;
      const webId = row.id as number;
      try {
        const text = await readFileText(webKey);
        if (text.length > 300_000) { // soft cap
          fileTexts.set(webId, text.slice(0, 300_000));
        } else {
          fileTexts.set(webId, text);
        }
      } catch (e) {
        console.warn("read file failed:", webKey, e);
        fileTexts.set(webId, "");
      }
    });

    const claimedSlugs = new Set<string>();

    type WorkerResult = { acceptedRows: any[]; summary: any };

    const worker = async (row: any): Promise<WorkerResult> => {
      const webId  = row.id as number;
      const webKey = row.path as string;
      const link   = String(row.link || "");
      const isMetrics = isMetricsPath(webKey);
      const text = fileTexts.get(webId) || "";

      const len = text.length;
      if (len <= 0 || !text.trim()) {
        return { acceptedRows: [], summary: { web_id: webId, web: webKey, scanned: false, reason: "empty" } };
      }
      if (len > MAX_LEN) {
        return { acceptedRows: [], summary: { web_id: webId, web: webKey, scanned: false, reason: "too_long" } };
      }

      // Extract cards
      let rawCards: any[] = [];
      let usedFallback = false;
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

      // Evidence gate only
      const requireEvidence = isMetrics ? REQUIRE_EVIDENCE_METRICS : REQUIRE_EVIDENCE_DEFAULT;
      let filtered = processedCards.filter(c => (requireEvidence ? c._hasEvidence : true));

      // Fallback to one if none pass evidence
      if (!filtered.length) {
        const lenient = processedCards
          .sort((a,b) => (b.confidence ?? 0) - (a.confidence ?? 0) || (b.score ?? 0) - (a.score ?? 0));
        if (lenient.length) {
          filtered = [lenient[0]];
          usedFallback = true;
        }
      }

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
        const mapped   = classifyScreenByTier(c.category, tier);
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
      if (usedFallback) summary.used_fallback = true;
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