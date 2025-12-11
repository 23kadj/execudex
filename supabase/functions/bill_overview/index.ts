/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== INDEXED STATUS MANAGEMENT ========================== */

/**
 * Check if a legislation profile is properly indexed and update the indexed column
 * A profile is considered indexed when:
 * - It has a row in legi_profiles
 * - It has a value in legi_profiles.overview
 * - It has a value for "updated_at" in legi_profiles
 */
async function updateLegislationIndexedStatus(id: number): Promise<void> {
  try {
    const { data: profileData, error } = await supabase
      .from("legi_profiles")
      .select("overview, updated_at")
      .eq("owner_id", id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn(`Error checking legi_profiles for id ${id}:`, error);
      return;
    }

    const isIndexed = !!(
      profileData && 
      profileData.overview && 
      profileData.updated_at
    );

    const { error: updateError } = await supabase
      .from("legi_index")
      .update({ indexed: isIndexed })
      .eq("id", id);

    if (updateError) {
      console.warn(`Failed to update indexed status for legi_index id ${id}:`, updateError);
    } else {
      console.log(`Updated indexed status for legi_index id ${id}: ${isIndexed}`);
    }
  } catch (error) {
    console.error(`Error in updateLegislationIndexedStatus for id ${id}:`, error);
  }
}

/** ========================== CONFIG ========================== */
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEB_BUCKET     = Deno.env.get("WEB_BUCKET") || "web";
const MISTRAL_API_KEY= Deno.env.get("MISTRAL_API_KEY")!;
const MISTRAL_MODEL  = Deno.env.get("MISTRAL_MODEL") || "mistral-small-latest";
const MISTRAL_TIMEOUT_MS = Number(Deno.env.get("MISTRAL_TIMEOUT_MS") || 90000);

/** Target word ranges */
const RANGES = {
  overview: { min: 20, max: 30 },
  agenda:   { min: 40, max: 50 },
  impact:   { min: 30, max: 40 },
};

/** ========================== CLIENT ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
const json = (status: number, body: any) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** ========================== STORAGE HELPERS ========================== */
async function listSynopsisPaths(id: number): Promise<string[]> {
  const prefix = `legi/${id}`;
  const { data, error } = await supabase.storage
    .from(WEB_BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  const files =
    (data || []).filter(
      (it) =>
        it &&
        !it.name.endsWith("/") &&
        /\.txt$/i.test(it.name) &&
        /synopsis/i.test(it.name)
    ) ?? [];
  return files.map((f) => `${prefix}/${f.name}`);
}

async function downloadText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(WEB_BUCKET).download(path);
  if (error) throw error;
  return await data.text();
}

/** ========================== DB HELPERS ========================== */
async function getLegiName(id: number): Promise<string> {
  const { data, error } = await supabase
    .from("legi_index")
    .select("id, name")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("legi_index row not found");
  return String(data.name || "").trim();
}

async function getLegiProfile(owner_id: number) {
  const { data, error } = await supabase
    .from("legi_profiles")
    .select("id, owner_id, overview, agenda, impact")
    .eq("owner_id", owner_id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** ========================== MISTRAL ========================== */
async function mistralJSONOnce(system: string, user: string, timeoutMs?: number) {
  const payload = {
    model: MISTRAL_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    max_tokens: 1200,
    messages: [
      { role: "system" as const, content: system },
      { role: "user"   as const, content: user },
    ],
  };

  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  };

  if (timeoutMs && timeoutMs > 0) {
    const controller = new AbortController();
    init.signal = controller.signal;
    const t = setTimeout(() => controller.abort("mistral_timeout"), timeoutMs);
    try {
      const r = await fetch("https://api.mistral.ai/v1/chat/completions", init);
      clearTimeout(t);
      if (!r.ok) throw new Error(`Mistral error ${r.status}`);
      const j = await r.json();
      const content = j?.choices?.[0]?.message?.content ?? "{}";
      try { return JSON.parse(content); } catch { return {}; }
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  } else {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", init);
    if (!r.ok) throw new Error(`Mistral error ${r.status}`);
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    try { return JSON.parse(content); } catch { return {}; }
  }
}

async function mistralJSONWithRetry(system: string, user: string) {
  try {
    return await mistralJSONOnce(system, user, MISTRAL_TIMEOUT_MS);
  } catch (e) {
    if (String(e).includes("mistral_timeout") || String(e).includes("The user aborted a request.")) {
      return await mistralJSONOnce(system, user, 0);
    }
    throw e;
  }
}

/** ========================== PROMPTS ========================== */
function makeMainPrompt(name: string, corpus: string) {
  const system = `
You are a precise legislative summarizer. Use ONLY the provided Congress synopsis text (no outside knowledge).
Write in neutral, plain English at a high-school reading level. Include concrete details grounded in the text.
Return STRICT JSON with keys: "overview", "agenda", "impact".
Hard word ranges (aim to land inside, but do not truncate mid-sentence):
- overview: 20–30 words
- agenda:   40–50 words
- impact:   30–40 words
Each must be one paragraph (no bullets, no quotes, no parentheses). Do not repeat the bill name.
`.trim();

  const user = `
BILL NAME: ${name || "—"}

SOURCE (Congress synopsis; use only this):
"""${corpus}"""

Write three fields:

1) OVERVIEW (20–30 words): what the bill does + 1–2 of its most notable/impactful elements, stated plainly and specifically.

2) AGENDA (40–50 words): the most important policy changes or actions, with specific examples (named programs, taxes, eligibility rules, standards, rescissions, fees, or agencies). Prefer concrete items over vague phrasing.

3) IMPACT (30–40 words): who is most affected and how. Explicitly name at least one demographic group (e.g., low-income households, veterans), one sector (e.g., agriculture, defense, healthcare), and a region if present in the synopsis (else state "nationwide"). Use plain, grounded claims.
`.trim();

  return { system, user };
}

async function refineFieldExact(
  field: "overview" | "agenda" | "impact",
  currentText: string,
  corpus: string,
  name: string,
  min: number,
  max: number,
  attempt: number
): Promise<string> {
  const target = attempt >= 1 ? max : Math.round((min + max) / 2);
  const extraImpact = field === "impact"
    ? `- Name at least one demographic group AND one sector. If a region is mentioned in the synopsis, include it; otherwise state "nationwide".`
    : ``;

  const system = `
You are a careful editor. Rewrite ONLY the requested field as one paragraph, using ONLY the provided Congress synopsis text.
Keep neutral, plain English, high-school reading level. Include concrete details/examples. No quotes, bullets, or parentheses.
Return STRICT JSON: {"${field}":"..."} with ${min}–${max} words (do not truncate mid-sentence). Target ~${target} words.
${extraImpact}
`.trim();

  const user = `
BILL NAME: ${name || "—"}

FIELD: ${field.toUpperCase()}
CURRENT (may be out of range):
"""${currentText}"""

SYNOPSIS (ground truth; use only this):
"""${corpus}"""
`.trim();

  const out = await mistralJSONWithRetry(system, user);
  const next = trim(String(out?.[field] ?? ""));
  return next || currentText;
}

/** NEW: soft enforcement — allow small overage, never trim mid-sentence */
async function enforceRangeSoft(
  field: "overview" | "agenda" | "impact",
  value: string,
  corpus: string,
  name: string,
  min: number,
  max: number
): Promise<string> {
  let text = trim(value);
  let wc = wordCount(text);

  // Already within range — accept as-is
  if (wc >= min && wc <= max) return text;

  // Over max
  if (wc > max) {
    const over = wc - max;
    // Allow over by ≤ 10 words
    if (over <= 10) return text;

    // Ask Mistral to redo once
    const redo = await refineFieldExact(field, text, corpus, name, min, max, 0);
    const wc2 = wordCount(redo);

    // If still over, allow overage by ≤10; else accept unedited redo anyway
    if (wc2 > max) {
      if (wc2 - max <= 10) return redo;
      return redo; // pass through uncut per your rule
    }
    // If now under, also pass through uncut (no trimming)
    return redo;
  }

  // Under min
  if (wc < min) {
    // Ask Mistral to redo once
    const redo = await refineFieldExact(field, text, corpus, name, min, max, 0);
    const wc2 = wordCount(redo);

    // If still under or now over: pass the redo unedited
    return redo;
  }

  return text;
}

/** ========================== HANDLER ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });
    const id = await readId(req);

    // 1) Bill name
    const billName = await getLegiName(id);

    // 2) Load ALL synopsis files
    const synopsisPaths = await listSynopsisPaths(id);
    let corpus = "";
    let hasData = true;

    if (!synopsisPaths.length) {
      console.warn(`No synopsis files found for id ${id}, will write "No Data"`);
      hasData = false;
    } else {
      // 3) Build corpus
      const parts: string[] = [];
      for (const p of synopsisPaths) {
        try { parts.push(await downloadText(p)); }
        catch (e) { 
          console.warn("download failed:", p, e); 
          // Continue with other files if some fail
        }
      }
      corpus = trim(parts.join("\n\n---\n\n"));
      if (!corpus) {
        console.warn(`Synopsis files were empty for id ${id}, will write "No Data"`);
        hasData = false;
      }
    }

    // 4) Main generation or fallback to "No Data"
    let overview, agenda, impact;
    
    if (!hasData) {
      overview = "No Data";
      agenda = "No Data";
      impact = "No Data";
    } else {
      const { system, user } = makeMainPrompt(billName, corpus);
      let j = await mistralJSONWithRetry(system, user);

      overview = trim(String(j?.overview ?? ""));
      agenda   = trim(String(j?.agenda   ?? ""));
      impact   = trim(String(j?.impact   ?? ""));

      // 5) Enforce ranges softly (no truncation)
      overview = await enforceRangeSoft("overview", overview, corpus, billName, RANGES.overview.min, RANGES.overview.max);
      agenda   = await enforceRangeSoft("agenda",   agenda,   corpus, billName, RANGES.agenda.min,   RANGES.agenda.max);
      impact   = await enforceRangeSoft("impact",   impact,   corpus, billName, RANGES.impact.min,   RANGES.impact.max);
    }

    // 6) Upsert into legi_profiles (always overwrite)
    const existing = await getLegiProfile(id);
    const wrote: string[] = [];

    const payload: any = { owner_id: id };
    if (overview) { payload.overview = overview; wrote.push("overview"); }
    if (agenda)   { payload.agenda   = agenda;   wrote.push("agenda"); }
    if (impact)   { payload.impact   = impact;   wrote.push("impact"); }

    if (!existing) {
      // Insert new profile
      const { error: insErr } = await supabase.from("legi_profiles").insert(payload).single();
      if (insErr) throw insErr;

      // Update indexed status after successful profile creation
      await updateLegislationIndexedStatus(id);

      return json(200, {
        id,
        action: "inserted",
        synopsis_files_used: synopsisPaths,
        wrote,
        preview: payload
      });
    } else {
      // Update existing profile (overwrite all fields)
      const { error: updErr } = await supabase.from("legi_profiles").update(payload).eq("owner_id", id);
      if (updErr) throw updErr;

      // Update indexed status after successful profile update
      await updateLegislationIndexedStatus(id);

      return json(200, {
        id,
        action: "overwritten",
        synopsis_files_used: synopsisPaths,
        wrote,
        preview: payload
      });
    }
  } catch (e: any) {
    console.error(e);
    const msg = String(e?.message || e || "unknown error");
    const status =
      /Missing or invalid id/.test(msg) ? 400
      : /legi_index row not found/.test(msg) ? 404
      : /No synopsis files/.test(msg) || /empty/.test(msg) ? 422
      : /Mistral error/.test(msg) ? 502
      : 500;

    return json(status, { error: msg });
  }
});
