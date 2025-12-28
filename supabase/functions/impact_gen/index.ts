/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** ======= config ======= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

// model: always use Medium
const MISTRAL_MEDIUM = "mistral-small-latest";

/** ======= supabase client ======= */
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { fetch } });

/** ======= helpers ======= */
function isNumericString(s: string | null): boolean {
  return !!s && /^\d+$/.test(s);
}

function isValidUuid(s: string | null): boolean {
  if (!s) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(s);
}

async function readRequestData(req: Request): Promise<{ cardId: number; userId: string }> {
  const url = new URL(req.url);
  
  // Try query params first
  const qId = url.searchParams.get("id") || url.searchParams.get("card_id");
  const qUserId = url.searchParams.get("user_id") || url.searchParams.get("userId");
  
  let cardId: number | null = null;
  let userId: string | null = null;
  
  if (isNumericString(qId)) {
    cardId = Number(qId);
  }
  if (qUserId && isValidUuid(qUserId)) {
    userId = qUserId;
  }
  
  // Try request body if needed
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({} as any));
    
    // Extract card_id
    if (cardId === null) {
      const id =
        typeof j.id === "number" ? j.id :
        typeof j.card_id === "number" ? j.card_id :
        (typeof j.id === "string" && isNumericString(j.id)) ? Number(j.id) :
        (typeof j.card_id === "string" && isNumericString(j.card_id)) ? Number(j.card_id) :
        null;
      if (id != null) cardId = id;
    }
    
    // Extract user_id
    if (userId === null) {
      const uid = typeof j.user_id === "string" ? j.user_id :
                  typeof j.userId === "string" ? j.userId :
                  typeof j.uuid === "string" ? j.uuid :
                  null;
      if (uid && isValidUuid(uid)) userId = uid;
    }
  } else if (!cardId) {
    // Try raw body as card_id
    const raw = await req.text().catch(() => "");
    if (isNumericString(raw.trim())) {
      cardId = Number(raw.trim());
    }
  }
  
  if (cardId === null) {
    throw new Error("Missing or invalid card_id. Provide as JSON { id } or { card_id }, query ?id=, or raw numeric body.");
  }
  
  if (userId === null) {
    throw new Error("Missing or invalid user_id. Provide as JSON { user_id } or { userId } or { uuid }, or query ?user_id=.");
  }
  
  return { cardId, userId };
}

/** Download entire stored page text (no truncation) */
async function downloadFullText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(WEB_BUCKET).download(path);
  if (error) throw error;
  return await data.text();
}

/** Parse onboard data string into key-value pairs */
function parseOnboardData(onboardData: string | null): Record<string, string> {
  const data: Record<string, string> = {};
  if (!onboardData) return data;

  const parts = onboardData.split(' | ');
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const key = part.substring(0, colonIndex).trim();
      const value = part.substring(colonIndex + 1).trim();
      data[key] = value;
    }
  }
  return data;
}

/** Generate personal impact text based on user demographics and card content */
async function generatePersonalImpact(opts: {
  title: string;
  subtext: string;
  bodyText: string;
  pageText: string;
  excerpt: string;
  onboardData: Record<string, string>;
}): Promise<{ impact: string; reasoning: string }> {
  // If no onboard data, return low impact message with reasoning included in impact text (max 50 words)
  const hasOnboardData = Object.keys(opts.onboardData).length > 0;
  if (!hasOnboardData) {
    const reasoning = "No demographic data available to assess personal impact.";
    const impactWithReasoning = "There is little to no personal impact for this info card. " + reasoning;
    console.log("Impact generation reasoning:", {
      hasReasoning: true,
      reasoning: reasoning,
      impactLength: impactWithReasoning.length,
      needsNote: false
    });
    return {
      impact: impactWithReasoning,
      reasoning: reasoning
    };
  }

  // Build demographic summary from onboard data
  const demographicFields = [
    "State Code", "Political Standing", "Highest Education Level", "Employment Status",
    "Income Level", "Race & Ethnicity", "Dependent Status", "Military Status",
    "Immigration Status", "Government Benefits", "Sexual Orientation", "Voter Eligibility",
    "Disability Status", "Industry of Work or Study", "Age", "Gender", "Political Involvement"
  ];
  
  const demographics: string[] = [];
  for (const field of demographicFields) {
    const value = opts.onboardData[field];
    if (value) {
      demographics.push(`${field}: ${value}`);
    }
  }

  const demographicSummary = demographics.length > 0 
    ? demographics.join(", ")
    : "No specific demographic information available";

  const sys = `You write personalized impact assessments for political/legislative information cards.
Return ONLY JSON like: {"impact":"...","needs_note":false,"reasoning":"..."} with valid JSON keys.
Rules:
- IMPACT: Write 0-100 words explaining how this card's information affects the person based on their demographics.
- If there is little to no direct correlation, write: "There is little to no personal impact for this info card"
- If there IS correlation, explain the specific impact clearly and concisely.
- If you find relevant information in the source document that isn't directly in the card but affects the person, you may include it, but set needs_note to true.
- The more direct the impact, the more you should write (up to 100 words).
- Be specific about which demographic factors create the impact.
- Write in a clear, accessible tone.
- REASONING (REQUIRED): Explain your decision-making process using the SAME CONTEXT as the card body text.
  * If there IS personal impact: Explain which demographic factors create the impact and how (can be longer, up to 100 words).
  * If there is NO personal impact: AIM for 50 words, but if additional context is needed to fully explain why there's no impact, you may use up to 100 words. Explain:
    - Which demographic factors you considered
    - Why none of them apply to this specific card's content
    - What the card is about that makes it irrelevant to the user's demographics
  * Prioritize being concise (50 words target), but include necessary context if it helps users understand why there's no impact (up to 100 words max).`;

  async function callOnce(payloadText: string) {
    const user = `
CARD TITLE: ${opts.title}
CARD SUBTEXT: ${opts.subtext}

CARD BODY TEXT (explanation of what this card is about):
${opts.bodyText}

PRIMARY EXCERPT (most relevant legal lines for this card):
${opts.excerpt}

FULL SOURCE PAGE (for additional context):
"""${payloadText}"""

USER DEMOGRAPHICS:
${demographicSummary}
`;

    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: MISTRAL_MEDIUM,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`Mistral error ${r.status}`);
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {}
    const impact = String(parsed?.impact ?? "").trim();
    const needsNote = parsed?.needs_note === true;
    const reasoning = String(parsed?.reasoning ?? "").trim();
    
    // Log reasoning (required - always log even if empty)
    console.log("Impact generation reasoning:", {
      hasReasoning: !!reasoning,
      reasoning: reasoning || "No reasoning provided by model",
      impactLength: impact.length,
      needsNote: needsNote
    });
    
    // Check if impact indicates low/no personal impact
    const isLowImpact = impact.toLowerCase().includes("little to no personal impact") || 
                        impact.toLowerCase().includes("no personal impact") ||
                        impact.toLowerCase().includes("minimal impact") ||
                        impact.trim().length === 0;
    
    // Add note if needed
    let finalImpact = impact;
    if (needsNote && impact && !impact.includes("Note:") && !impact.includes("note:")) {
      finalImpact = impact + " Note: While not directly related to this card, the source document mentions information that may be relevant to your demographic profile.";
    }
    
    // If low/no impact and we have reasoning, append reasoning to explain why
    // (Model should already keep it to 50-100 words per prompt instructions)
    if (isLowImpact && reasoning) {
      // Check if reasoning is already included in the impact text
      if (!finalImpact.includes(reasoning)) {
        finalImpact = finalImpact.trim();
        if (!finalImpact.endsWith(".") && !finalImpact.endsWith("!")) {
          finalImpact += ".";
        }
        finalImpact += " " + reasoning;
      }
    }
    
    // Fallback if impact is empty
    if (!finalImpact.trim()) {
      const fallbackImpact = "There is little to no personal impact for this info card.";
      if (reasoning) {
        // Model should already keep reasoning to 50-100 words per prompt instructions
        finalImpact = fallbackImpact + " " + reasoning;
      } else {
        finalImpact = fallbackImpact + " No specific demographic factors apply to this card's content.";
      }
    }
    
    return {
      impact: finalImpact,
      reasoning: reasoning
    };
  }

  try {
    const result = await callOnce(opts.pageText);
    if (result && result.impact) return result;
  } catch (e) {
    console.error("Error in impact generation (full text):", e);
  }

  const last10k = opts.pageText.slice(-10_000);
  try {
    const result = await callOnce(last10k);
    if (result && result.impact) return result;
  } catch (e) {
    console.error("Error in impact generation (last 10k):", e);
  }

  const fallbackReasoning = "Unable to assess personal impact due to processing error.";
  const fallbackImpact = "There is little to no personal impact for this info card. " + fallbackReasoning;
  console.log("Impact generation reasoning:", {
    hasReasoning: true,
    reasoning: fallbackReasoning,
    impactLength: fallbackImpact.length,
    needsNote: false
  });
  return {
    impact: fallbackImpact,
    reasoning: fallbackReasoning
  };
}

/** ======= main ======= */
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1) Input: card_id and user_id (both required)
    const { cardId, userId } = await readRequestData(req);
    console.log("Impact generation request:", { cardId, userId });

    // 2) Check if impact already exists (client should check, but double-check here)
    const { data: existingImpact } = await supabase
      .from("impact")
      .select("id")
      .eq("user_id", userId)
      .eq("card_id", cardId)
      .maybeSingle();
    
    if (existingImpact) {
      console.log("Impact already exists for user:", userId, "card:", cardId);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Impact already exists",
        card_id: cardId,
        user_id: userId
      }), { 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 3) Fetch card_index to get title, subtext, and web path
    const { data: card, error: cErr } = await supabase
      .from("card_index")
      .select("id, title, subtext, web")
      .eq("id", cardId)
      .single();
    
    if (cErr || !card) {
      console.error("Card not found:", cardId);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Card not found" 
      }), {
        status: 404, 
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4) Fetch card_content to get body_text and excerpt
    const { data: cardContent, error: ccErr } = await supabase
      .from("card_content")
      .select("body_text, excerpt")
      .eq("card_id", cardId)
      .maybeSingle();
    
    if (ccErr || !cardContent || !cardContent.body_text) {
      console.error("Card content not found or missing body_text:", cardId);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Card content not found or incomplete" 
      }), {
        status: 404, 
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5) Download full page text from storage
    const webPath: string = String(card.web || "");
    if (!webPath) {
      console.error("Card has no web path:", cardId);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Card has no source file" 
      }), {
        status: 404, 
        headers: { "Content-Type": "application/json" }
      });
    }

    let fullText = "";
    try {
      fullText = await downloadFullText(webPath);
    } catch (e) {
      console.error("Failed to download source text:", webPath, e);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to download source text" 
      }), {
        status: 502, 
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (!fullText.trim()) {
      console.error("Source text is empty:", webPath);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Source text is empty" 
      }), {
        status: 404, 
        headers: { "Content-Type": "application/json" }
      });
    }

    // 6) Fetch user onboard data
    let onboardData: Record<string, string> = {};
    try {
      console.log("Fetching onboard data for user:", userId);
      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("onboard")
        .eq("uuid", userId)
        .maybeSingle();
      
      if (userErr) {
        console.error("Error fetching onboard data:", userErr);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Failed to fetch user data" 
        }), {
          status: 500, 
          headers: { "Content-Type": "application/json" }
        });
      } else if (userRow?.onboard) {
        onboardData = parseOnboardData(userRow.onboard);
        console.log("Onboard data fetched, fields:", Object.keys(onboardData).length);
      } else {
        console.log("No onboard data found for user:", userId);
        // Continue - will generate "no impact" message
      }
    } catch (e) {
      console.error("Failed to fetch onboard data:", e);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to fetch onboard data" 
      }), {
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }

    // 7) Generate personal impact
    console.log("Generating personal impact for user:", userId, "card:", cardId);
    const impactResult = await generatePersonalImpact({
      title: String(card.title || ""),
      subtext: String(card.subtext || ""),
      bodyText: String(cardContent.body_text || ""),
      pageText: fullText,
      excerpt: String(cardContent.excerpt || ""),
      onboardData
    });
    
    const impactText = impactResult.impact;
    console.log("Impact generated, length:", impactText?.length || 0);
    console.log("Impact reasoning logged above (see 'Impact generation reasoning' log entry)");

    // 8) Save impact to impact table (upsert: update if exists, insert if not)
    try {
      // First check if a row already exists for this user_id + card_id
      const { data: existing, error: checkErr } = await supabase
        .from("impact")
        .select("id")
        .eq("user_id", userId)
        .eq("card_id", cardId)
        .maybeSingle();
      
      let impactData;
      let impactErr;
      
      if (checkErr && checkErr.code !== "PGRST116") {
        // PGRST116 is "not found" which is fine, other errors are real issues
        console.error("Error checking existing impact:", checkErr);
      }
      
      if (existing) {
        // Update existing row
        const { data, error } = await supabase
          .from("impact")
          .update({ impact: impactText })
          .eq("id", existing.id)
          .select();
        impactData = data;
        impactErr = error;
        if (impactErr) {
          console.error("Failed to update impact:", impactErr);
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Failed to save impact" 
          }), {
            status: 500, 
            headers: { "Content-Type": "application/json" }
          });
        } else {
          console.log("Impact updated successfully for existing row id:", existing.id);
        }
      } else {
        // Insert new row (don't specify id, let auto-increment handle it)
        const { data, error } = await supabase
          .from("impact")
          .insert({
            user_id: userId,
            card_id: cardId,
            impact: impactText
          })
          .select();
        impactData = data;
        impactErr = error;
        if (impactErr) {
          // If insert fails with duplicate key, try update instead
          if (impactErr.code === "23505") {
            console.log("Insert failed due to duplicate, trying update instead");
            const { data: updateData, error: updateErr } = await supabase
              .from("impact")
              .update({ impact: impactText })
              .eq("user_id", userId)
              .eq("card_id", cardId)
              .select();
            if (updateErr) {
              console.error("Failed to update impact after insert conflict:", updateErr);
              return new Response(JSON.stringify({ 
                success: false, 
                error: "Failed to save impact" 
              }), {
                status: 500, 
                headers: { "Content-Type": "application/json" }
              });
            } else {
              console.log("Impact updated successfully after insert conflict");
              impactData = updateData;
            }
          } else {
            console.error("Failed to insert impact:", impactErr);
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Failed to save impact" 
            }), {
              status: 500, 
              headers: { "Content-Type": "application/json" }
            });
          }
        } else {
          console.log("Impact inserted successfully:", impactData);
        }
      }
    } catch (e) {
      console.error("Exception saving impact:", e);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Exception saving impact" 
      }), {
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }

    // 9) Return success
    return new Response(JSON.stringify({
      success: true,
      card_id: cardId,
      user_id: userId
    }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ 
      success: false,
      error: String(err) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

