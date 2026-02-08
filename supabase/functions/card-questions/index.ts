/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEB_BUCKET = Deno.env.get("WEB_BUCKET") || "web";
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
const MISTRAL_MODEL = "mistral-small-latest";

const MAX_ANSWER_WORDS = 55;

// Profanity - common swear words (including leetspeak/variants)
const PROFANITY_PATTERNS = [
  /\bf+u+c+k+/i, /\bs+h+i+t+/i, /\ba+s+s+h+o+l+e+/i, /\bb+i+t+c+h+/i,
  /\bn+i+g+g+a+/i, /\bc+u+n+t+/i, /\bd+a+m+n+/i, /\bp+i+s+s+/i,
  /\bw+h+o+r+e+/i, /\bs+l+u+t+/i, /\bc+o+c+k+/i, /\bd+i+c+k+/i,
  /\bc+r+a+p+/i, /\bh+e+l+l+/i, /\bb+a+s+t+a+r+d+/i, /\bp+r+i+c+k+/i,
  /\bwhore\b/i, /\bslut\b/i, /\bfuck\b/i, /\bshit\b/i, /\bass\b/i,
  /\bdick\b/i, /\bcock\b/i, /\bdamn\b/i, /\bbitch\b/i, /\bcrap\b/i,
];

// Hate speech and slurs
const HATE_SPEECH_PATTERNS = [
  /\bn+i+g+[e]+r+\b/i, /\bf+a+g+g+o+t?\b/i, /\bk+i+k+e+\b/i,
  /\br+e+t+a+r+d+/i, /\bt+r+a+n+n+y+\b/i, /\bc+h+i+n+k+\b/i,
];

// Question indicators - must have at least one
const QUESTION_INDICATORS = [
  /\?/, /\b(who|what|where|when|why|how|which|whose|whom)\b/i,
  /\b(is|are|was|were|do|does|did|can|could|will|would|should|has|have)\s+\w/i,
  /\b(explain|describe|tell me|what's|whats)\b/i,
];

function isQuestionInappropriate(question: string): boolean {
  const q = question.trim();
  if (q.length < 5) return true;
  if (PROFANITY_PATTERNS.some((p) => p.test(q))) return true;
  if (HATE_SPEECH_PATTERNS.some((p) => p.test(q))) return true;
  if (!QUESTION_INDICATORS.some((p) => p.test(q))) return true;
  return false;
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE!, { global: { fetch } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function downloadFullText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(WEB_BUCKET).download(path);
  if (error) throw error;
  return await data.text();
}

async function answerQuestionWithMistral(question: string, pageText: string): Promise<string> {
  const systemPrompt = `You are a helpful assistant that answers questions using ONLY the provided web page content.
Rules:
1. Answer using information from the provided content. Do not use outside knowledge.
2. Your answer must be at most ${MAX_ANSWER_WORDS} words. Be concise and direct.
3. If the content does not fully address the question, say what you can from the content or briefly note the limitation.
4. Always provide a response. No preamble like "Based on the content."`;

  const userPrompt = `Content from the source page:
---
${pageText}
---

Question: ${question}

Answer the question using only the content above. Maximum ${MAX_ANSWER_WORDS} words.`;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Mistral API error:", res.status, errText);
    throw new Error(`Mistral API error: ${res.status}`);
  }

  const json = await res.json();
  let content = json.choices?.[0]?.message?.content?.trim() ?? "";

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_ANSWER_WORDS) {
    const words = content.split(/\s+/).filter(Boolean).slice(0, MAX_ANSWER_WORDS);
    content = words.join(" ");
  }

  return content;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const cardId = typeof body.card_id === "number" ? body.card_id : typeof body.card_id === "string" ? parseInt(body.card_id, 10) : null;

    if (!question || question.length > 100) {
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cardId || !Number.isFinite(cardId)) {
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isQuestionInappropriate(question)) {
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: card, error: cardErr } = await supabase
      .from("card_index")
      .select("id, web, is_ppl")
      .eq("id", cardId)
      .single();

    if (cardErr || !card) {
      console.error("Card not found:", cardId);
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webPath = String(card.web || "");
    if (!webPath) {
      console.error("Card has no web path:", cardId);
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pageText = "";
    try {
      pageText = await downloadFullText(webPath);
    } catch (e) {
      console.error("Failed to download source:", webPath, e);
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pageText.trim()) {
      console.error("Source text is empty for card:", cardId);
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const answer = await answerQuestionWithMistral(question, pageText);

    if (!answer.trim()) {
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("questions")
      .insert({
        card_id: cardId,
        question,
        answer: answer.trim(),
      })
      .select("id, question, answer, created_at")
      .single();

    if (insertErr) {
      console.error("Failed to save question:", insertErr);
      return new Response(JSON.stringify({ success: false, fail: true }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: inserted.id,
        question: inserted.question,
        answer: inserted.answer,
        created_at: inserted.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("card-questions error:", e);
    return new Response(JSON.stringify({ success: false, fail: true }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
