import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin =
    ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

const SYSTEM_PROMPTS: Record<string, string> = {
  chat: `You are RentelX AI — an expert Israeli rental market assistant built into the RentelX apartment-hunting platform.
You help users find apartments, negotiate rent, understand Israeli rental law, and analyze listings.
Answer in the same language the user writes in (Hebrew or English).
Be concise, practical, and friendly. Use bullet points when listing steps or tips.
Focus on the Gush Dan area (Tel Aviv, Givatayim, Ramat Gan) when giving location-specific advice.`,

  analyze: `You are a rental listing analyst for the Israeli market.
Extract key details, list pros and cons, flag red flags, and give a clear recommendation (1–10 score with explanation).
Be concise and structured. Answer in the user's language (Hebrew or English).`,

  summarize: `Summarize the following rental listing concisely in 2–3 sentences, highlighting price, location, size, and key amenities.
Answer in the user's language (Hebrew or English).`,
};

// Model priority list — tries each in order until one succeeds
const MODELS = [
  "anthropic/claude-3-haiku",
  "google/gemini-flash-1.5",
  "meta-llama/llama-3.1-8b-instruct:free",
];

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 30000,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://rental-copilot.lovable.app",
        "X-Title": "RentelX AI",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`OpenRouter ${model} → ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const json = await res.json();
    const content: string | undefined = json?.choices?.[0]?.message?.content;
    if (content && content.trim()) return content.trim();
    return null;
  } catch (e) {
    clearTimeout(timer);
    console.warn(`OpenRouter ${model} error:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { messages, type = "chat" } = body as {
      messages: Array<{ role: string; content: string }>;
      type?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY env var is not set");
      return new Response(
        JSON.stringify({ content: "AI service is not configured. Please contact support." }),
        { status: 200, headers: corsHeaders }
      );
    }

    const systemPrompt = SYSTEM_PROMPTS[type] ?? SYSTEM_PROMPTS.chat;

    // Try each model in priority order
    for (const model of MODELS) {
      const content = await callOpenRouter(apiKey, model, systemPrompt, messages);
      if (content) {
        console.log(`ai-assist: replied via ${model} (${content.length} chars)`);
        return new Response(
          JSON.stringify({ content }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // All models failed
    console.error("ai-assist: all models failed");
    return new Response(
      JSON.stringify({ content: "מצטער, שירות ה-AI אינו זמין כרגע. נסו שוב בעוד מספר דקות.\n\nSorry, the AI service is temporarily unavailable. Please try again in a few minutes." }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error("ai-assist fatal error:", e);
    return new Response(
      JSON.stringify({ content: "שגיאה בשירות ה-AI. נסו שוב.\n\nAI service error. Please try again." }),
      { status: 200, headers: corsHeaders }
    );
  }
});
