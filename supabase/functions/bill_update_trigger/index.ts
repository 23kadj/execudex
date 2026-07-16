/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Manual trigger for the legislation update pipeline (Update Legislation button
 * on the Explore page). bill_update_runs is service-role-only (RLS, no policies),
 * so the client can't read run state or register a new run itself -- this function
 * mediates both, then calls bill_update and waits for it. There's no cooldown: any
 * number of runs can be triggered back to back, since bill_update/bill_search already
 * skip bills that already have a profile. The only thing blocked is a second run
 * starting while one is still actually in flight.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// A real run finishes in ~2 minutes (see bill_update's RUN_BUDGET_MS). If this function
// itself dies mid-request (network drop, etc.) before bill_update reports back, the run
// row is left "triggered" with no finished_at forever -- treat anything older than this
// as abandoned rather than let it permanently block future runs.
const STALE_RUN_MS = 5 * 60 * 1000;

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
      .select("triggered_at, finished_at")
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRunErr) {
      return new Response(JSON.stringify({ ok: false, error: `Failed to check run status: ${lastRunErr.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (lastRun?.triggered_at && !lastRun.finished_at) {
      const elapsedMs = Date.now() - new Date(lastRun.triggered_at).getTime();
      if (elapsedMs < STALE_RUN_MS) {
        return new Response(JSON.stringify({
          ok: false,
          blocked: true,
          reason: "in_progress",
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
