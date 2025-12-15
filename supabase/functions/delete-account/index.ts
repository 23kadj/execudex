/// <reference lib="dom" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // keep secret
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    // Client for reading caller's session
    // Use anon key + bearer token so supabase-js sends the caller's session
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    const authedUser = userData.user;
    const userId = authedUser.id; // UUID in auth.users; you said this matches users.uuid

    // Admin client for destructive ops
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Delete data rows owned by the user (your app’s tables)
    // Delete from your users data table by uuid
    const { error: delUserRowErr } = await admin
      .from("users")
      .delete()
      .eq("uuid", userId);
    if (delUserRowErr) {
      return new Response(`Failed deleting users row: ${delUserRowErr.message}`, { status: 400, headers: cors });
    }

    // If you have more tables that reference users.uuid and don’t use ON DELETE CASCADE,
    // delete them here too (e.g., bookmarks, subscriptions, etc.)

    // 2) Delete auth user (removes from auth.users)
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(userId);
    if (delAuthErr) {
      return new Response(`Failed deleting auth user: ${delAuthErr.message}`, { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(e?.message ?? "Server error", { status: 500, headers: cors });
  }
});
