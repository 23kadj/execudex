/// <reference lib="deno.unstable" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ----------------------------- CORS ----------------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

/* ----------------------------- TYPES ---------------------------- */
type ProfileType = "politician" | "legislation";
type ActionType = "mark_indexed" | "mark_weak" | "mark_unweak" | "mark_unindexed";
interface BodyReq {
  profileId?: number | string;
  profileType?: ProfileType;
  action?: ActionType;
}

/* ----------------------------- UTILS ---------------------------- */
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function readEnv(name: string): string {
  const val = Deno.env.get(name);
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

async function readInput(req: Request): Promise<{ id: number; type: ProfileType; action: ActionType }> {
  const url = new URL(req.url);
  const qpId = url.searchParams.get("id");
  const qpType = url.searchParams.get("type") as ProfileType | null;
  const qpAction = url.searchParams.get("action") as ActionType | null;

  let body: BodyReq = {};
  const ct = req.headers.get("content-type") || "";
  if (req.method === "POST" && ct.includes("application/json")) {
    try { body = await req.json(); } catch { /* ignore bad JSON, fall back to query */ }
  }

  const rawId = body.profileId ?? qpId;
  const type = (body.profileType ?? qpType) as ProfileType | undefined;
  const action = (body.action ?? qpAction) as ActionType | undefined;

  if (!rawId || !type || !action) {
    throw Object.assign(new Error("Missing required parameters: profileId, profileType, action"), { code: "INVALID_INPUT" });
  }

  const id = typeof rawId === "number" ? rawId : Number.parseInt(String(rawId), 10);
  if (!Number.isFinite(id)) {
    throw Object.assign(new Error("profileId must be a number"), { code: "INVALID_ID" });
  }

  if (!["politician", "legislation"].includes(type)) {
    throw Object.assign(new Error('profileType must be "politician" or "legislation"'), { code: "INVALID_PROFILE_TYPE" });
  }
  if (!["mark_indexed", "mark_weak", "mark_unweak", "mark_unindexed"].includes(action)) {
    throw Object.assign(
      new Error('action must be one of: mark_indexed, mark_weak, mark_unweak, mark_unindexed'),
      { code: "INVALID_ACTION" }
    );
  }

  return { id, type, action };
}

function tableFor(type: ProfileType): "ppl_index" | "legi_index" {
  return type === "politician" ? "ppl_index" : "legi_index";
}

function patchFor(action: ActionType): Record<string, unknown> {
  switch (action) {
    case "mark_indexed":   return { indexed: true  };
    case "mark_unindexed": return { indexed: false };
    case "mark_weak":      return { weak: true     };
    case "mark_unweak":    return { weak: false    };
  }
}

/* ----------------------------- CLIENT -------------------------- */
const SUPABASE_URL = readEnv("SUPABASE_URL");
const SERVICE_ROLE = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/* ----------------------------- SERVER -------------------------- */
Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { success: false, error: "METHOD_NOT_ALLOWED", message: "Use POST" });

    let id: number, type: ProfileType, action: ActionType;
    try { ({ id, type, action } = await readInput(req)); }
    catch (e: any) { return json(400, { success: false, error: e?.code || "INVALID_INPUT", message: e?.message || "Bad request" }); }

    const table = tableFor(type);
    const patch = patchFor(action);

    const { data, error } = await supabase
      .from(table)
      .update(patch)          // <-- no updated_at here
      .eq("id", id)
      .select("id, name, indexed, weak")
      .single();

    if (error) {
      console.error(`[profile_labeling] Update error`, { table, id, action, error });
      return json(500, {
        success: false,
        error: "UPDATE_FAILED",
        message: `Failed to update ${type} profile`,
        details: error.message ?? String(error),
      });
    }

    return json(200, {
      success: true,
      message: `Successfully ${action.replace("mark_", "")} ${type} profile ${id}`,
      profileId: id,
      profileType: type,
      action,
      updated: data,
    });
  } catch (e: any) {
    console.error("[profile_labeling] Unexpected error", e);
    return json(500, { success: false, error: "INTERNAL", message: e?.message || "Internal server error" });
  }
});
