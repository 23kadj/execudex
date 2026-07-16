/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Manual trigger for the legislation update pipeline (Update Legislation button
 * on the Explore page). bill_update_runs is service-role-only (RLS, no policies),
 * so the client can't read the last-run timestamp or register a new run itself --
 * this function mediates both, then calls bill_update and waits for it, so the
 * client gets one round trip: blocked-with-cooldown-info, or the finished result.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COOLDOWN_DAYS = 7;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Use POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { data: lastRun, error: lastRunErr } = await supabase
      .from("bill_update_runs")
      .select("triggered_at")
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRunErr) {
      return new Response(JSON.stringify({ ok: false, error: `Failed to check last update: ${lastRunErr.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (lastRun?.triggered_at) {
      const elapsedMs = Date.now() - new Date(lastRun.triggered_at).getTime();
      const daysSince = elapsedMs / (24 * 60 * 60 * 1000);
      if (daysSince < COOLDOWN_DAYS) {
        return new Response(JSON.stringify({
          ok: false,
          blocked: true,
          daysSinceLastUpdate: Math.max(0, Math.floor(daysSince)),
          daysUntilNextAllowed: Math.max(1, Math.ceil(COOLDOWN_DAYS - daysSince)),
        }), { headers: { "Content-Type": "application/json" } });
      }
    }

    const { data: newRun, error: insertErr } = await supabase
      .from("bill_update_runs")
      .insert({ status: "triggered" })
      .select("id")
      .single();

    if (insertErr || !newRun) {
      return new Response(JSON.stringify({ ok: false, error: `Failed to register update run: ${insertErr?.message || "unknown error"}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const runId = newRun.id as number;

    const billUpdateResponse = await fetch(`${SUPABASE_URL}/functions/v1/bill_update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE}`
      },
      body: JSON.stringify({ run_id: runId })
    });

    const result = await billUpdateResponse.json().catch(() => ({ ok: false, error: "bill_update returned invalid JSON" }));

    return new Response(JSON.stringify({ ...result, run_id: runId }), {
      status: billUpdateResponse.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
