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
Focus on the Gush Dan area (Tel Aviv, Givatayim, Ramat Gan, Holon, Bat Yam, Bnei Brak, Petah Tikva, Herzliya, Rishon LeZion) when giving location-specific advice.
Current date: ${new Date().toISOString().slice(0, 10)}. Prices in ILS (₪).`,

  analyze: `You are a rental listing analyst for the Israeli market (Gush Dan region).
Your job:
1. Extract and confirm all key details: address, price (₪/month), rooms, sqm, floor, amenities.
2. List 3–5 PROS and 2–4 CONS in bullet points.
3. Flag any RED FLAGS (unusually high/low price, missing info, suspicious contact, no photos).
4. Give a 1–10 SCORE with a one-sentence explanation.
5. Give a clear RECOMMENDATION: "Worth viewing", "Skip", or "Negotiate price first".
Be structured, concise, and data-driven. Answer in the user's language (Hebrew or English).
Use Israeli market benchmarks: Tel Aviv avg ₪6,000–₪9,000 for 2–3 rooms; Gush Dan avg ₪4,500–₪7,000.`,

  summarize: `Summarize the following rental listing in exactly 2–3 sentences.
Include: price per month in ₪, location/neighborhood, size (rooms + sqm), and top 2–3 amenities.
Be factual — only state what is mentioned in the listing, do not invent details.
Answer in the user's language (Hebrew or English).`,

  extract: `You are a precise data extraction engine for Israeli rental listings.
You will receive the ACTUAL CONTENT of a listing page (HTML text or plain text) that was fetched from the web.
Extract ONLY the data that is explicitly present in the provided content.

Return ONLY valid JSON in this exact format:
{
  "address": "street and number or null",
  "neighborhood": "neighborhood name or null",
  "city": "city name in Hebrew or null",
  "price": number or null,
  "rooms": number or null,
  "sqm": number or null,
  "floor": number or null,
  "total_floors": number or null,
  "description": "clean description text or null",
  "amenities": ["list", "of", "amenities"],
  "contact_name": "name or null",
  "contact_phone": "phone or null",
  "image_urls": ["url1", "url2"]
}

CRITICAL RULES:
- Extract ONLY data that exists in the provided text. NEVER guess or invent data.
- If a field is not found in the text, use null.
- Extract Hebrew amenities as-is (חניה, מעלית, מרפסת, מיזוג, ממ"ד, מרוהטת, מחסן, גינה, ריהוט, etc.).
- For Facebook posts: extract phone numbers, price, rooms count, location from the post text.
- For Yad2: extract all structured data fields.
- Extract image URLs when found (og:image meta tags, img src attributes, data-src).
- Phone numbers: look for Israeli patterns (05X-XXXXXXX, 0X-XXXXXXX, +972...).
- Price: look for numbers near ₪, ש"ח, שקל, NIS, or "שכירות" / "rent" / "להשכרה".
- Rooms: look for "חדרים", "חד'", "rooms", or X.5 patterns.
- Return ONLY the JSON object, no other text.`,
};

// Model priority list — tries each in order until one succeeds
const MODELS = [
  "anthropic/claude-3-5-haiku",
  "anthropic/claude-3-haiku",
  "google/gemini-flash-1.5",
  "meta-llama/llama-3.1-8b-instruct:free",
];

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const { maxTokens = 1024, temperature = 0.7, timeoutMs = 30000 } = opts;
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
        max_tokens: maxTokens,
        temperature,
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

/* ── Fetch actual web page content from URL ── */
async function fetchUrlContent(url: string): Promise<{ text: string; images: string[] } | null> {
  const BROWSER_HEADERS: Record<string, string> = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Cache-Control": "no-cache",
  };

  // For Facebook, add mobile user agent to get simpler HTML
  const isFacebook = url.includes("facebook.com") || url.includes("fb.com");
  if (isFacebook) {
    BROWSER_HEADERS["User-Agent"] = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[fetch-url] HTTP ${res.status} from ${url}`);
      return null;
    }

    const html = await res.text();

    // Extract images from og:image, meta tags, and img elements
    const images: string[] = [];
    const ogImageMatches = html.matchAll(/(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/gi);
    for (const m of ogImageMatches) {
      if (m[1] && !m[1].includes("placeholder")) images.push(m[1]);
    }
    const imgSrcMatches = html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi);
    for (const m of imgSrcMatches) {
      if (m[1] && m[1].startsWith("http") && !m[1].includes("logo") && !m[1].includes("icon") && !m[1].includes("avatar") && !m[1].includes("emoji")) {
        images.push(m[1]);
      }
    }

    // Strip HTML to get clean text content
    const text = htmlToText(html);
    return { text: text.slice(0, 12000), images: images.slice(0, 10) };
  } catch (e) {
    clearTimeout(timer);
    console.warn(`[fetch-url] Error fetching ${url}:`, (e as Error)?.message);
    return null;
  }
}

/* ── Convert HTML to readable text ── */
function htmlToText(html: string): string {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Extract meta description
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : "";

  // Extract og:description
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : "";

  // Extract JSON-LD structured data (common on listing sites)
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let jsonLdText = "";
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1]);
      jsonLdText += "\n" + JSON.stringify(data, null, 0);
    } catch { /* skip malformed JSON-LD */ }
  }

  // Remove scripts, styles, and irrelevant elements
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Convert block elements to newlines
    .replace(/<\/?(div|p|br|h[1-6]|li|tr|td|section|article)[^>]*>/gi, "\n")
    // Remove remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Build final content with metadata first
  const parts: string[] = [];
  if (title) parts.push(`PAGE TITLE: ${title}`);
  if (metaDesc) parts.push(`META DESCRIPTION: ${metaDesc}`);
  if (ogDesc && ogDesc !== metaDesc) parts.push(`OG DESCRIPTION: ${ogDesc}`);
  if (jsonLdText) parts.push(`STRUCTURED DATA: ${jsonLdText.slice(0, 3000)}`);
  parts.push(`\nPAGE CONTENT:\n${text}`);

  return parts.join("\n");
}

/* ── Extract URL from message content ── */
function extractUrlFromMessage(messages: Array<{ role: string; content: string }>): string | null {
  for (const msg of messages) {
    const urlMatch = msg.content.match(/https?:\/\/[^\s"'<>]+/);
    if (urlMatch) return urlMatch[0];
  }
  return null;
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

    // For extraction: fetch the actual URL content and include it in the message
    let enrichedMessages = messages;
    if (type === "extract") {
      const url = extractUrlFromMessage(messages);
      if (url) {
        console.log(`[ai-assist] Fetching URL content: ${url}`);
        const fetched = await fetchUrlContent(url);

        if (fetched && fetched.text.length > 50) {
          console.log(`[ai-assist] Fetched ${fetched.text.length} chars, ${fetched.images.length} images from ${url}`);
          // Replace the user message with one that includes the actual content
          enrichedMessages = [{
            role: "user",
            content: [
              `Extract rental listing data from the following page content.`,
              `SOURCE URL: ${url}`,
              fetched.images.length > 0 ? `\nIMAGES FOUND ON PAGE:\n${fetched.images.join("\n")}` : "",
              `\n--- PAGE CONTENT START ---\n${fetched.text}\n--- PAGE CONTENT END ---`,
              `\nExtract ONLY data that appears in the content above. Return JSON only.`,
            ].join("\n"),
          }];
        } else {
          console.warn(`[ai-assist] Could not fetch URL content (${fetched?.text.length ?? 0} chars). Sending URL for best-effort extraction.`);
          // If fetch failed, still tell the AI we couldn't get the content
          enrichedMessages = [{
            role: "user",
            content: [
              `I tried to fetch this rental listing URL but could not retrieve the page content: ${url}`,
              ``,
              `The URL appears to be from: ${url.includes("facebook") ? "Facebook Marketplace / Groups" : url.includes("yad2") ? "Yad2" : "a rental listing website"}`,
              ``,
              `Based ONLY on what can be inferred from the URL structure (if any listing ID or parameters are visible), return what you can.`,
              `For any data that cannot be determined from the URL alone, you MUST use null.`,
              `Do NOT invent or guess any data. Return JSON with mostly null values rather than fabricated data.`,
            ].join("\n"),
          }];
        }
      }
    }

    const callOpts = type === "extract"
      ? { maxTokens: 1200, temperature: 0.1, timeoutMs: 45000 }
      : type === "analyze"
      ? { maxTokens: 1200, temperature: 0.4 }
      : { maxTokens: 1024, temperature: 0.7 };

    // Try each model in priority order
    for (const model of MODELS) {
      const content = await callOpenRouter(apiKey, model, systemPrompt, enrichedMessages, callOpts);
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
