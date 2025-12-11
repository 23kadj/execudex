/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ========================== CONFIG ========================== */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** ========================== SUPABASE ========================== */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ========================== UTILS ========================== */
function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readId(req: Request): Promise<number> {
  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: number };
  if (typeof id !== "number") throw new Error("Body must include { id: number }");
  return id;
}

/** ========================== HELPER FUNCTIONS ========================== */

/** Call profile_index function for legislation */
async function callProfileIndex(id: number): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/profile_index`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, is_ppl: false }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`profile_index failed: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/** Call bill_overview function */
async function callBillOverview(id: number): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/bill_overview`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`bill_overview failed: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/** Call bill_text function */
async function callBillText(id: number): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/bill_text`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`bill_text failed: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/** Call bill_cards function */
async function callBillCards(id: number): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/bill_cards`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`bill_cards failed: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/** Call bill_coverage function */
async function callBillCoverage(id: number): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/bill_coverage`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`bill_coverage failed: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/** ========================== MAIN PROCESSOR ========================== */

async function processLegislationProfile(id: number) {
  const results = {
    id,
    steps_completed: [] as string[],
    steps_failed: [] as string[],
    final_status: "incomplete" as "complete" | "incomplete",
    error_message: null as string | null,
  };

  try {
    // Initial check: Get legislation row
    const { data: legiRow, error: legiError } = await supabase
      .from("legi_index")
      .select("*")
      .eq("id", id)
      .single();
    
    if (legiError || !legiRow) {
      throw new Error(`Legislation with ID ${id} not found in legi_index`);
    }

    // STEP 1: Check sub_name in legi_index
    if (!legiRow.sub_name) {
      console.log(`Step 1: Missing sub_name for legislation ${id}, calling profile_index...`);
      try {
        await callProfileIndex(id);
        results.steps_completed.push("profile_index");
        console.log(`Step 1 completed: profile_index for legislation ${id}`);
      } catch (error) {
        const errorMsg = `Step 1 failed (profile_index): ${error.message}`;
        results.steps_failed.push(errorMsg);
        throw new Error(errorMsg);
      }
    } else {
      console.log(`Step 1: sub_name already exists for legislation ${id}, skipping profile_index`);
      results.steps_completed.push("profile_index (skipped - already exists)");
    }

    // STEP 2: Check legi_profiles table
    const { data: profileRow, error: profileError } = await supabase
      .from("legi_profiles")
      .select("*")
      .eq("owner_id", id)
      .single();

    if (profileError || !profileRow) {
      console.log(`Step 2: No profile found for legislation ${id}, calling bill_overview...`);
      try {
        await callBillOverview(id);
        results.steps_completed.push("bill_overview");
        console.log(`Step 2 completed: bill_overview for legislation ${id}`);
      } catch (error) {
        const errorMsg = `Step 2 failed (bill_overview): ${error.message}`;
        results.steps_failed.push(errorMsg);
        throw new Error(errorMsg);
      }
    } else {
      console.log(`Step 2: Profile already exists for legislation ${id}, skipping bill_overview`);
      results.steps_completed.push("bill_overview (skipped - already exists)");
    }

    // STEP 3: Check card_index for existing cards
    const { data: existingCards, error: cardsError } = await supabase
      .from("card_index")
      .select("id")
      .eq("owner_id", id)
      .eq("is_ppl", false);

    if (cardsError) {
      console.warn(`Error checking existing cards for legislation ${id}:`, cardsError);
    }

    const hasExistingCards = existingCards && existingCards.length > 0;

    if (!hasExistingCards) {
      console.log(`Step 3: No cards found for legislation ${id}, calling bill_text...`);
      try {
        await callBillText(id);
        results.steps_completed.push("bill_text");
        console.log(`Step 3a completed: bill_text for legislation ${id}`);
      } catch (error) {
        const errorMsg = `Step 3a failed (bill_text): ${error.message}`;
        results.steps_failed.push(errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`Step 4: bill_cards SKIPPED for legislation ${id} (initial profile processing)`);
      results.steps_completed.push("bill_cards (skipped - initial processing)");

      console.log(`Step 5: bill_coverage SKIPPED for legislation ${id} (initial profile processing)`);
      results.steps_completed.push("bill_coverage (skipped - initial processing)");
    } else {
      console.log(`Step 3-5: Cards already exist for legislation ${id}, skipping card generation steps`);
      results.steps_completed.push("bill_text (skipped - cards exist)");
      results.steps_completed.push("bill_cards (skipped - cards exist)");
      results.steps_completed.push("bill_coverage (skipped - cards exist)");
    }

    // All steps completed successfully
    results.final_status = "complete";
    console.log(`Legislation profile processing completed successfully for ID ${id}`);

  } catch (error) {
    results.final_status = "incomplete";
    results.error_message = error.message;
    console.error(`Legislation profile processing failed for ID ${id}:`, error);
  }

  return results;
}

/** ========================== HTTP HANDLER ========================== */
Deno.serve(async (req) => {
  try {
    if (req.method === "GET") {
      return json(200, {
        message: "legislation_profile_processor: POST { id }",
        description: "Processes legislation profile through all required steps: profile_index, bill_overview, bill_text, bill_cards, bill_coverage"
      });
    }

    if (req.method !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const id = await readId(req);
    const results = await processLegislationProfile(id);

    return json(200, results);

  } catch (error: any) {
    console.error("Legislation profile processor error:", error);
    return json(500, {
      error: error?.message || String(error),
      message: "Legislation profile not available"
    });
  }
});
