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
- For amenities: ONLY include amenities that are explicitly mentioned as present.
- Do NOT fabricate amenities or default to common ones. If the page does not mention מיזוג (AC), do NOT include it.
- An empty amenities array [] is correct if no amenities are mentioned.

AMENITIES — Extract ALL of these ONLY when explicitly mentioned (in Hebrew or English):
  סורגים (window bars), מזגן/מיזוג/מזגן מרכזי (AC/central AC), ממ"ד/ממד (safe room), מעלית (elevator),
  מרפסת (balcony), חניה (parking), מחסן (storage), גינה (garden),
  דוד שמש (solar water heater), גישה לנכים (disabled access),
  מרוהטת/ריהוט (furnished), משופצת/שיפוץ (renovated), מזגן טורנדו (tornado AC),
  בויילר (boiler), דלת פלדלת/דלת פלדה (security door), סורגים חשמליים (electric bars),
  מיקום שקט (quiet location), חניה תת-קרקעית (underground parking),
  גז מרכזי (central gas), תריסים חשמליים (electric shutters),
  מרפסת שמש (sun balcony), ארונות קיר/ארון קיר (built-in closets),
  מכונת כביסה (washing machine), מייבש כביסה (dryer),
  מערכת אזעקה (alarm system), אינטרקום (intercom),
  דלתות פנדור (pandoor doors), משופצת חדש (newly renovated),
  ריצוף חדש (new flooring), אמבטיה (bathtub), מקלחון (shower stall),
  מתאים לשותפים (suitable for roommates), דלתות רב בריח (multi-lock doors),
  משופצת (renovated/refurbished)
  Keep the original Hebrew terms as they appear. If the listing says "יש/אין" (has/doesn't have), extract accordingly.
  Look for Yad2/Madlan amenity sections like "מה יש בנכס?" or "what's in the property" — extract all items listed there.

FACEBOOK-SPECIFIC RULES:
- Facebook posts often have listing data in free text form within the description or title.
- Look for price patterns: numbers followed by ₪, ש"ח, שקל, NIS, or near words like שכירות, rent, להשכרה, לחודש.
- Look for room count: NUMBER + חדרים, חד', rooms, or X.5 patterns.
- Look for floor info: קומה + NUMBER, floor + NUMBER, NUMBER/NUMBER (floor/total).
- Look for sqm: NUMBER + מ"ר, מטר, sqm, m².
- Look for address: street names (רחוב, רח'), neighborhoods, or city names.
- Extract phone numbers: Israeli patterns 05X-XXXXXXX, 0X-XXXXXXX, +972, or raw digits like 0501234567.
- Extract the poster's name as contact_name if visible.
- Even partial data from Facebook OG tags (title, description) is valuable — extract what you can.

YAD2 RULES:
- Extract all structured data fields including exact amenities list.
- Floor format is often "קומה X מתוך Y" — extract both floor and total_floors.

MADLAN-SPECIFIC RULES:
- Madlan pages show property details in structured sections.
- Look for "מה יש בנכס?" (What's in the property) section and extract ALL listed amenities with their icons/labels.
- Look for structured info: rooms (חדרים), floor (קומה), area/size (שטח/מ"ר), price (מחיר/₪).
- Extract address from the page title or header sections.
- Contact info might be behind "הצגת מספר טלפון" or "שליחת הודעה" buttons — extract any visible contact details.
- Madlan may have "היסטוריית שווי נכס" (property value history) — ignore this, focus on rental data.

GENERAL:
- Extract image URLs when found (og:image meta tags, img src attributes).
- Return ONLY the JSON object, no other text.`,
};

// Model priority list — tries each in order until one succeeds
const MODELS = [
  "anthropic/claude-3-5-haiku",
  "anthropic/claude-3-haiku",
  "google/gemini-flash-1.5-8b",
  "google/gemini-flash-1.5",
  "meta-llama/llama-3.1-8b-instruct:free",
];

// Stronger models for extraction (more capable at parsing complex HTML/JSON)
const EXTRACT_MODELS = [
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-5-haiku",
  "google/gemini-flash-1.5",
  "anthropic/claude-3-haiku",
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

/* ── Extract images from HTML ── */
function extractImagesFromHtml(html: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  const addImage = (url: string) => {
    if (!url || seen.has(url)) return;
    // Filter out non-listing images
    const lower = url.toLowerCase();
    if (lower.includes("placeholder") || lower.includes("logo") || lower.includes("icon") ||
        lower.includes("avatar") || lower.includes("emoji") || lower.includes("static") ||
        lower.includes("rsrc.php") || lower.includes("pixel") || lower.includes("tracking") ||
        lower.includes("blank.gif") || lower.includes("spinner") || lower.includes("badge") ||
        lower.includes("flag") || lower.length < 20) return;
    seen.add(url);
    images.push(url);
  };

  // og:image — support both attribute orders
  const ogImagePatterns = [
    /(?:property|name)=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::url)?["']/gi,
  ];
  for (const pattern of ogImagePatterns) {
    for (const m of html.matchAll(pattern)) addImage(m[1]);
  }

  // Twitter card images
  const twitterImgPatterns = [
    /(?:property|name)=["']twitter:image["'][^>]*content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image["']/gi,
  ];
  for (const pattern of twitterImgPatterns) {
    for (const m of html.matchAll(pattern)) addImage(m[1]);
  }

  // JSON-LD images
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1]);
      const extractJsonLdImages = (obj: any) => {
        if (!obj) return;
        if (typeof obj === "string" && obj.startsWith("http") && /\.(jpg|jpeg|png|webp|avif)/i.test(obj)) addImage(obj);
        if (Array.isArray(obj)) obj.forEach(extractJsonLdImages);
        if (typeof obj === "object") {
          for (const key of ["image", "photo", "thumbnail", "images", "photos"]) {
            if (obj[key]) {
              if (typeof obj[key] === "string") addImage(obj[key]);
              else if (Array.isArray(obj[key])) obj[key].forEach((u: any) => { if (typeof u === "string") addImage(u); else if (u?.url) addImage(u.url); });
              else if (obj[key]?.url) addImage(obj[key].url);
            }
          }
        }
      };
      extractJsonLdImages(data);
    } catch { /* skip */ }
  }

  // img src/data-src
  const imgSrcMatches = html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi);
  for (const m of imgSrcMatches) {
    if (m[1] && m[1].startsWith("http")) addImage(m[1]);
  }

  // srcset — extract the largest image
  const srcsetMatches = html.matchAll(/srcset=["']([^"']+)["']/gi);
  for (const m of srcsetMatches) {
    const parts = m[1].split(",").map(s => s.trim().split(/\s+/));
    // Get the largest (last) source
    const last = parts[parts.length - 1];
    if (last?.[0]?.startsWith("http")) addImage(last[0]);
  }

  // background-image patterns
  const bgImageMatches = html.matchAll(/background-image:\s*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/gi);
  for (const m of bgImageMatches) addImage(m[1]);

  // data-image attributes (common on Yad2/Madlan)
  const dataImgMatches = html.matchAll(/data-(?:image|img|photo|src)=["'](https?:\/\/[^"']+)["']/gi);
  for (const m of dataImgMatches) addImage(m[1]);

  return images;
}

/* ── Extract Open Graph meta tags from HTML ── */
function extractOgMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const patterns = [
    /(?:property|name)=["']og:([^"']+)["'][^>]*content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["'][^>]*(?:property|name)=["']og:([^"']+)["']/gi,
  ];
  for (const m of html.matchAll(patterns[0])) {
    if (m[1] && m[2]) meta[m[1].toLowerCase()] = m[2];
  }
  for (const m of html.matchAll(patterns[1])) {
    if (m[1] && m[2]) meta[m[2].toLowerCase()] = m[1];
  }
  // Also extract standard meta tags
  const metaPatterns = /name=["'](?:description|keywords)["'][^>]*content=["']([^"']+)["']/gi;
  for (const m of html.matchAll(metaPatterns)) {
    if (m[1]) meta["meta_description"] = m[1];
  }
  return meta;
}

/* ── Convert Facebook share URL to mbasic URL for better scraping ── */
function getFacebookUrls(url: string): string[] {
  const urls: string[] = [];

  // Try mbasic.facebook.com version (simplest HTML, best for scraping)
  try {
    const parsed = new URL(url);
    // Convert share URLs: facebook.com/share/XXX
    if (parsed.pathname.startsWith("/share/")) {
      // Try mbasic version of share URL
      urls.push(`https://mbasic.facebook.com${parsed.pathname}`);
      // Also try mobile version
      urls.push(`https://m.facebook.com${parsed.pathname}`);
    }
    // For standard post/group URLs
    const mbasicUrl = url.replace(/www\.facebook\.com/, "mbasic.facebook.com").replace(/m\.facebook\.com/, "mbasic.facebook.com");
    if (!urls.includes(mbasicUrl)) urls.push(mbasicUrl);
    // Also try mobile version
    const mobileUrl = url.replace(/www\.facebook\.com/, "m.facebook.com").replace(/mbasic\.facebook\.com/, "m.facebook.com");
    if (!urls.includes(mobileUrl)) urls.push(mobileUrl);
    // Original URL as fallback
    if (!urls.includes(url)) urls.push(url);
  } catch {
    urls.push(url);
  }

  return urls;
}

/* ── Fetch a single URL and return HTML ── */
async function fetchSingleUrl(url: string, headers: Record<string, string>): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[fetch-url] HTTP ${res.status} from ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    console.warn(`[fetch-url] Error fetching ${url}:`, (e as Error)?.message);
    return null;
  }
}

/* ── Validate URL is not targeting internal/private networks ── */
function isPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    // Block private/internal hostnames
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) return false;
    if (hostname.startsWith("172.") && /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    // Block metadata endpoints (cloud providers)
    if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") return false;
    // Must use http or https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}

/* ── Fetch actual web page content from URL ── */
async function fetchUrlContent(url: string): Promise<{ text: string; images: string[] } | null> {
  if (!isPublicUrl(url)) {
    console.warn(`[fetch-url] Blocked non-public URL: ${url}`);
    return null;
  }
  const BROWSER_HEADERS: Record<string, string> = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "Upgrade-Insecure-Requests": "1",
  };

  const isFacebook = url.includes("facebook.com") || url.includes("fb.com");
  const isYad2 = url.includes("yad2.co.il");
  const isMadlan = url.includes("madlan.co.il");

  if (isYad2) {
    BROWSER_HEADERS["Origin"] = "https://www.yad2.co.il";
    BROWSER_HEADERS["Referer"] = "https://www.yad2.co.il/";
  }

  if (isMadlan) {
    BROWSER_HEADERS["Origin"] = "https://www.madlan.co.il";
    BROWSER_HEADERS["Referer"] = "https://www.madlan.co.il/";
  }

  // ── Facebook: try multiple URL variants (mbasic, mobile, original) ──
  if (isFacebook) {
    // Try different user agents for Facebook
    const fbUserAgents = [
      // Facebook's own crawler gets the best OG data
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      // Googlebot also gets good data from Facebook
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      // Mobile user agent
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      // WhatsApp link preview bot (Facebook respects its own ecosystem)
      "WhatsApp/2.23.20 A",
      // Telegram bot
      "TelegramBot (like TwitterBot)",
    ];

    const fbUrls = getFacebookUrls(url);
    let bestResult: { text: string; images: string[]; ogMeta: Record<string, string> } | null = null;

    for (const fbUrl of fbUrls) {
      for (const ua of fbUserAgents) {
        const fbHeaders: Record<string, string> = { ...BROWSER_HEADERS, "User-Agent": ua };
        // Remove browser-specific headers for bots
        if (ua.includes("externalhit") || ua.includes("Googlebot") || ua.includes("WhatsApp") || ua.includes("TelegramBot")) {
          delete fbHeaders["sec-ch-ua"];
          delete fbHeaders["sec-ch-ua-mobile"];
          delete fbHeaders["sec-ch-ua-platform"];
          delete fbHeaders["sec-fetch-dest"];
          delete fbHeaders["sec-fetch-mode"];
          delete fbHeaders["sec-fetch-site"];
          delete fbHeaders["sec-fetch-user"];
          delete fbHeaders["Upgrade-Insecure-Requests"];
        }
        console.log(`[fetch-url] Trying Facebook URL: ${fbUrl} with UA: ${ua.slice(0, 40)}...`);
        const html = await fetchSingleUrl(fbUrl, fbHeaders);
        if (!html) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        const images = extractImagesFromHtml(html);
        const ogMeta = extractOgMeta(html);
        const text = htmlToText(html);

        // Check if this result has useful content (not just a login page)
        const isLoginPage = html.includes("login_form") || html.includes("/login/") ||
          (text.length < 200 && !ogMeta.description && !ogMeta.title);

        if (!isLoginPage && text.length > 100) {
          console.log(`[fetch-url] Got ${text.length} chars from ${fbUrl}`);
          return { text: text.slice(0, 15000), images: images.slice(0, 15) };
        }

        // Even if it's a login page, OG meta tags may have useful data
        if (ogMeta.description || ogMeta.title) {
          const metaText = buildFacebookMetaText(ogMeta, text);
          if (!bestResult || metaText.length > bestResult.text.length) {
            bestResult = { text: metaText, images, ogMeta };
          }
        }

        await new Promise(r => setTimeout(r, 400));
        // If we got good OG data, no need to try more UAs for this URL
        if (bestResult && bestResult.text.length > 200) break;
      }
      // If we have good enough data, stop trying more URLs
      if (bestResult && bestResult.text.length > 200) break;
    }

    // Return the best result we got (even if partial from OG meta)
    if (bestResult) {
      console.log(`[fetch-url] Using Facebook result (${bestResult.text.length} chars)`);
      return { text: bestResult.text.slice(0, 15000), images: bestResult.images.slice(0, 15) };
    }

    console.warn(`[fetch-url] All Facebook URL variants failed for ${url}`);
    return null;
  }

  // ── Madlan: try multiple user agents and URL variants ──
  if (isMadlan) {
    const madlanUserAgents = [
      // Googlebot gets the full server-rendered page from Next.js sites
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      // Facebook's crawler also gets good SSR content
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      BROWSER_HEADERS["User-Agent"],
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    ];

    // Build URL variants to try
    const madlanUrls: string[] = [];
    try {
      const parsed = new URL(url);
      // Original URL first (most likely to work)
      madlanUrls.push(url);
      // Mobile version (simpler HTML)
      const mobileUrl = `https://m.madlan.co.il${parsed.pathname}${parsed.search}`;
      if (!madlanUrls.includes(mobileUrl)) madlanUrls.push(mobileUrl);
      // API endpoint for listing pages
      const listingIdMatch = parsed.pathname.match(/\/listings\/([^/?]+)/);
      if (listingIdMatch) {
        const lid = listingIdMatch[1];
        madlanUrls.push(`https://www.madlan.co.il/api/listings/${lid}`);
        madlanUrls.push(`https://www.madlan.co.il/api/v1/listings/${lid}`);
        // Also try nadlan (property info) API endpoints
        madlanUrls.push(`https://gw.madlan.co.il/api/listings/${lid}`);
      }
      // For sale/rent listing pages with different path structure
      const altIdMatch = parsed.pathname.match(/\/(?:rent|sale|נכס|property)\/([^/?]+)/);
      if (altIdMatch) {
        madlanUrls.push(`https://www.madlan.co.il/api/listings/${altIdMatch[1]}`);
      }
    } catch {
      madlanUrls.push(url);
    }

    let bestResult: { text: string; images: string[] } | null = null;

    for (const madlanUrl of madlanUrls) {
      for (const ua of madlanUserAgents) {
        const madlanHeaders: Record<string, string> = { ...BROWSER_HEADERS, "User-Agent": ua };
        // For API endpoint, accept JSON
        if (madlanUrl.includes("/api/")) {
          madlanHeaders["Accept"] = "application/json";
        }
        // Clean up bot headers
        if (ua.includes("Googlebot") || ua.includes("externalhit")) {
          delete madlanHeaders["sec-ch-ua"];
          delete madlanHeaders["sec-ch-ua-mobile"];
          delete madlanHeaders["sec-ch-ua-platform"];
          delete madlanHeaders["sec-fetch-dest"];
          delete madlanHeaders["sec-fetch-mode"];
          delete madlanHeaders["sec-fetch-site"];
        }
        console.log(`[fetch-url] Trying Madlan URL: ${madlanUrl} with UA: ${ua.slice(0, 30)}...`);
        const html = await fetchSingleUrl(madlanUrl, madlanHeaders);
        if (!html) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }

        // Check if we got JSON response (API endpoint or __NEXT_DATA__)
        if (html.trim().startsWith("{") || html.trim().startsWith("[")) {
          try {
            const data = JSON.parse(html);
            const jsonText = `STRUCTURED DATA (API): ${JSON.stringify(data, null, 0).slice(0, 10000)}`;
            return { text: jsonText, images: extractImagesFromHtml(html).slice(0, 15) };
          } catch { /* not JSON, continue */ }
        }

        const images = extractImagesFromHtml(html);
        const ogMeta = extractOgMeta(html);
        let text = htmlToText(html);

        // Add Madlan-specific structured data extraction
        const madlanStructured = extractMadlanStructured(html);
        if (madlanStructured) {
          text = madlanStructured + "\n" + text;
        }

        // Check for meaningful content
        if (text.length > 200) {
          console.log(`[fetch-url] Got ${text.length} chars from ${madlanUrl}`);
          // For Madlan, always prepend OG meta for extra context
          const ogParts: string[] = [];
          if (ogMeta.title) ogParts.push(`LISTING TITLE: ${ogMeta.title}`);
          if (ogMeta.description) ogParts.push(`LISTING DESCRIPTION: ${ogMeta.description}`);
          const fullText = ogParts.length > 0
            ? ogParts.join("\n") + "\n\n" + text
            : text;
          return { text: fullText.slice(0, 20000), images: images.slice(0, 15) };
        }

        // Fallback to OG meta data
        if (ogMeta.description || ogMeta.title) {
          const parts: string[] = [];
          if (ogMeta.title) parts.push(`LISTING TITLE: ${ogMeta.title}`);
          if (ogMeta.description) parts.push(`LISTING DESCRIPTION: ${ogMeta.description}`);
          if (ogMeta["site_name"]) parts.push(`SOURCE: ${ogMeta["site_name"]}`);
          if (madlanStructured) parts.push(madlanStructured);
          parts.push(`\nPAGE CONTENT:\n${text}`);
          const metaText = parts.join("\n");
          if (!bestResult || metaText.length > bestResult.text.length) {
            bestResult = { text: metaText, images };
          }
        }

        await new Promise(r => setTimeout(r, 400));
        if (bestResult && bestResult.text.length > 300) break;
      }
      if (bestResult && bestResult.text.length > 300) break;
    }

    if (bestResult) {
      console.log(`[fetch-url] Using Madlan result (${bestResult.text.length} chars)`);
      return { text: bestResult.text.slice(0, 18000), images: bestResult.images.slice(0, 15) };
    }
  }

  // ── Non-Facebook/Madlan: standard fetch with retries ──
  for (let attempt = 0; attempt < 3; attempt++) {
    // Try different user agents on retries
    const headers = { ...BROWSER_HEADERS };
    if (attempt === 1) {
      headers["User-Agent"] = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    } else if (attempt === 2) {
      headers["User-Agent"] = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    }

    const html = await fetchSingleUrl(url, headers);
    if (!html) {
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const images = extractImagesFromHtml(html);
    const text = htmlToText(html);
    if (text.length < 30) {
      console.warn(`[fetch-url] Very short content (${text.length} chars) from ${url}`);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
    }
    return { text: text.slice(0, 15000), images: images.slice(0, 15) };
  }
  return null;
}

/* ── Build text from Facebook OG meta tags ── */
function buildFacebookMetaText(ogMeta: Record<string, string>, rawText: string): string {
  const parts: string[] = [];
  if (ogMeta.title) parts.push(`LISTING TITLE: ${ogMeta.title}`);
  if (ogMeta.description) parts.push(`LISTING DESCRIPTION: ${ogMeta.description}`);
  if (ogMeta["site_name"]) parts.push(`SOURCE: ${ogMeta["site_name"]}`);

  // Extract ALL OG meta tags (some may contain useful listing data)
  for (const [key, val] of Object.entries(ogMeta)) {
    if (!["title", "description", "site_name", "image", "url", "type"].includes(key) && val) {
      parts.push(`OG:${key}: ${val}`);
    }
  }

  // Try to extract useful content from the raw text too
  // Filter out Facebook boilerplate more aggressively
  const boilerplate = new Set([
    "log in", "sign up", "create account", "facebook", "forgot password",
    "cookie", "privacy policy", "terms of service", "accessibility",
    "help center", "meta", "marketplace", "groups", "gaming", "watch",
    "meta quest", "messenger", "whatsapp", "instagram", "threads",
    "fundraisers", "pokes", "professional dashboard", "pages",
    "advertising", "create a page", "developers", "careers", "about",
    "english", "עברית", "see more", "like", "comment", "share",
    "write a comment", "press enter", "most relevant",
  ]);

  const filteredLines = rawText.split("\n")
    .filter(line => {
      const l = line.trim().toLowerCase();
      if (l.length < 3) return false;
      // Keep lines with rental/listing keywords
      const hasKeyword = /חדר|מ"ר|שכיר|להשכ|מחיר|₪|ש"ח|שקל|קומה|מרפסת|חני|מעלית|מיזוג|ממ"ד|rooms?|price|floor|sqm|rent/i.test(l);
      if (hasKeyword) return true;
      // Keep lines with phone numbers
      if (/05\d[\d\-\s]{6,}|0[23489][\d\-\s]{6,}|\+972/.test(l)) return true;
      // Keep lines with addresses
      if (/רחוב|רח'|street|st\.|כתובת/.test(l)) return true;
      // Filter out known boilerplate
      for (const b of boilerplate) {
        if (l.includes(b)) return false;
      }
      return l.length > 10;
    });
  if (filteredLines.length > 0) {
    parts.push(`\nPAGE CONTENT:\n${filteredLines.join("\n")}`);
  }

  return parts.join("\n");
}

/* ── Convert HTML to readable text ── */
function htmlToText(html: string): string {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Extract meta description
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : "";

  // Extract og:description (both attribute orders)
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : "";

  // Extract og:title
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : "";

  // Extract JSON-LD structured data (common on listing sites)
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let jsonLdText = "";
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1]);
      jsonLdText += "\n" + JSON.stringify(data, null, 0);
    } catch { /* skip malformed JSON-LD */ }
  }

  // Extract __NEXT_DATA__ (common on Next.js sites like Madlan)
  let nextDataText = "";
  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      // Extract page props which contain listing data
      const props = data?.props?.pageProps;
      if (props) {
        // Deep extract: Madlan nests listing data in various places
        const deepExtract = (obj: any, depth = 0): any => {
          if (depth > 5 || !obj) return obj;
          if (typeof obj !== "object") return obj;
          // Look for listing-like objects with price/rooms/address fields
          const keys = Object.keys(obj);
          const isListing = keys.some(k =>
            ["price", "rooms", "address", "street", "sqm", "area", "floor", "amenities",
             "phone", "contact", "description", "neighborhood", "city",
             "מחיר", "חדרים", "כתובת", "שכונה", "קומה"].includes(k.toLowerCase())
          );
          if (isListing) return obj;
          // Recurse into nested objects
          for (const k of keys) {
            if (typeof obj[k] === "object" && obj[k] !== null) {
              const found = deepExtract(obj[k], depth + 1);
              if (found && typeof found === "object" && Object.keys(found).length > 3) {
                return found;
              }
            }
          }
          return obj;
        };
        const listing = deepExtract(props);
        // Include both the deep-extracted listing and the full props (limited)
        const listingJson = JSON.stringify(listing, null, 0);
        const propsJson = JSON.stringify(props, null, 0);
        nextDataText = listingJson.length > 100
          ? `LISTING DATA: ${listingJson.slice(0, 8000)}\nFULL PROPS: ${propsJson.slice(0, 4000)}`
          : propsJson.slice(0, 10000);
      }
    } catch { /* skip */ }
  }

  // Extract data from window.__data or similar globals
  const windowDataPatterns = [
    /window\.__data\s*=\s*({[\s\S]*?});/i,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.listing\s*=\s*({[\s\S]*?});/i,
    /window\.pageData\s*=\s*({[\s\S]*?});/i,
  ];
  let windowDataText = "";
  for (const pattern of windowDataPatterns) {
    const m = html.match(pattern);
    if (m) {
      try {
        const data = JSON.parse(m[1]);
        windowDataText += JSON.stringify(data, null, 0).slice(0, 3000);
      } catch { /* skip */ }
    }
  }

  // Remove scripts, styles, and irrelevant elements
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    // Convert block elements to newlines
    .replace(/<\/?(div|p|br|h[1-6]|li|tr|td|th|section|article|dt|dd|figcaption)[^>]*>/gi, "\n")
    // Extract aria-label content (often contains useful data)
    .replace(/aria-label=["']([^"']+)["']/gi, " $1 ")
    // Remove remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lrm;/g, "")
    .replace(/&rlm;/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Build final content with metadata first (structured data is most reliable)
  const parts: string[] = [];
  if (title) parts.push(`PAGE TITLE: ${title}`);
  if (ogTitle && ogTitle !== title) parts.push(`OG TITLE: ${ogTitle}`);
  if (metaDesc) parts.push(`META DESCRIPTION: ${metaDesc}`);
  if (ogDesc && ogDesc !== metaDesc) parts.push(`OG DESCRIPTION: ${ogDesc}`);
  if (jsonLdText) parts.push(`STRUCTURED DATA (JSON-LD): ${jsonLdText.slice(0, 4000)}`);
  if (nextDataText) parts.push(`STRUCTURED DATA (NEXT): ${nextDataText.slice(0, 4000)}`);
  if (windowDataText) parts.push(`STRUCTURED DATA (WINDOW): ${windowDataText.slice(0, 3000)}`);
  parts.push(`\nPAGE CONTENT:\n${text}`);

  return parts.join("\n");
}

/* ── Extract structured data from Madlan HTML (specific DOM patterns) ── */
function extractMadlanStructured(html: string): string {
  const parts: string[] = [];

  // Extract data from Madlan-specific script tags and data attributes
  const dataScripts = html.matchAll(/<script[^>]*>[\s\S]*?(?:listing|property|item)\s*[:=]\s*({[\s\S]*?})\s*[;,][\s\S]*?<\/script>/gi);
  for (const m of dataScripts) {
    try {
      const data = JSON.parse(m[1]);
      parts.push(`INLINE DATA: ${JSON.stringify(data, null, 0).slice(0, 3000)}`);
    } catch { /* skip */ }
  }

  // Extract from data-testid or data-auto-id attributes (Madlan uses these)
  const dataTestIds = html.matchAll(/data-(?:testid|auto-id)=["']([^"']*(?:price|room|floor|area|address|contact|phone|amenit)[^"']*)["'][^>]*>([^<]*)</gi);
  for (const m of dataTestIds) {
    if (m[2]?.trim()) parts.push(`${m[1]}: ${m[2].trim()}`);
  }

  // Extract from aria-label attributes that contain property data
  const ariaLabels = html.matchAll(/aria-label=["']([^"']*(?:חדר|קומה|מ"ר|מטר|מחיר|שכירות|רחוב|כתובת)[^"']*)["']/gi);
  for (const m of ariaLabels) {
    parts.push(`ARIA: ${m[1]}`);
  }

  // Look for Madlan's property details section
  const propertySection = html.match(/(?:מה יש בנכס|פרטי הנכס|מאפייני הנכס|What's in the property)([\s\S]{0,3000}?)(?:<\/(?:section|div)>|$)/i);
  if (propertySection) {
    const cleanSection = propertySection[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanSection.length > 10) parts.push(`PROPERTY FEATURES: ${cleanSection}`);
  }

  // Look for React state in HTML comments or hydration data
  const reactState = html.match(/__APOLLO_STATE__\s*=\s*({[\s\S]*?});/);
  if (reactState) {
    try {
      const data = JSON.parse(reactState[1]);
      // Find listing-related entries
      for (const [key, val] of Object.entries(data)) {
        if (key.toLowerCase().includes("listing") || key.toLowerCase().includes("property")) {
          parts.push(`APOLLO: ${JSON.stringify(val, null, 0).slice(0, 3000)}`);
          break;
        }
      }
    } catch { /* skip */ }
  }

  return parts.length > 0 ? `\nMADLAN STRUCTURED DATA:\n${parts.join("\n")}` : "";
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
          const sourceHint = url.includes("facebook") ? "Facebook"
            : url.includes("yad2") ? "Yad2"
            : url.includes("madlan") ? "Madlan"
            : url.includes("homeless") ? "Homeless"
            : url.includes("winwin") ? "WinWin"
            : url.includes("onmap") ? "OnMap"
            : url.includes("komo") ? "Komo"
            : "rental listing website";
          const isFbSource = sourceHint === "Facebook";
          const isMadlanSource = sourceHint === "Madlan";
          const isYad2Source = sourceHint === "Yad2";

          const sourceNotes: string[] = [];
          if (isFbSource) {
            sourceNotes.push(`FACEBOOK NOTE — CRITICAL: Facebook listings often contain ALL data in a single free-text block. You MUST parse it carefully:
1. LISTING DESCRIPTION: This is the MAIN source of data. Scan every word carefully.
2. Look for PRICE: any number near ₪/ש"ח/שקל/NIS/שכירות/rent/להשכרה/לחודש. Format: "4500 ש״ח", "₪4,500", "4500 שקל לחודש".
3. Look for ROOMS: number near חדרים/חד'/rooms. Also X.5 patterns like "3.5 חד'".
4. Look for SQM: number near מ"ר/מטר/sqm/m²/meters. Format: "60 מ\"ר", "60 sqm".
5. Look for FLOOR: number near קומה/floor. Format: "קומה 3", "קומה 3 מתוך 5", "floor 3/5".
6. Look for ADDRESS: any street name (רחוב/רח') + number, or neighborhood + city name.
7. Look for PHONE: Israeli phone numbers 05X-XXXXXXX, 0X-XXXXXXX, +972. May appear anywhere in text.
8. Look for CONTACT NAME: the poster's name (usually appears at top or end of post).
9. Look for AMENITIES: scan for Hebrew amenity keywords anywhere in the text.
10. Even if data comes from OG meta tags only (title/description), extract EVERYTHING you can from those strings.
If the text mentions "Marketplace" — this is a marketplace listing, look for structured fields.`);
          }
          if (isMadlanSource) {
            sourceNotes.push(`MADLAN NOTE — CRITICAL: Madlan is a Next.js site. The MOST RELIABLE data is in these sections (check them ALL in order):
1. LISTING DATA / STRUCTURED DATA (NEXT) — This contains the actual listing JSON from Madlan's database. Look for fields like "price", "rooms", "address", "street", "area", "floor", "sqm", "amenities", "phone", "description". Parse the JSON carefully.
2. MADLAN STRUCTURED DATA — Contains data extracted from specific Madlan DOM elements.
3. JSON-LD — Standard structured data.
4. OG TITLE / OG DESCRIPTION — Contains address and basic info from the page title.
5. PAGE CONTENT — Raw text from the page.

For Madlan addresses: The OG title often contains the FULL ADDRESS like "רחוב X 12, עיר" — extract it!
For Madlan amenities: Look for "מה יש בנכס" or "PROPERTY FEATURES" section and extract ALL listed items.
For Madlan contact: Phone number is often in NEXT_DATA as "phone" or "contactPhone".
For Madlan images: Look for image URLs in NEXT_DATA and og:image.`);
          }
          if (isYad2Source) {
            sourceNotes.push(`YAD2 NOTE: Extract all structured fields. Floor format is often "קומה X מתוך Y" or "X/Y". Look for the amenities section with all available features. Contact phone may be partially hidden — extract whatever is visible.`);
          }

          enrichedMessages = [{
            role: "user",
            content: [
              `Extract rental listing data from the following ${sourceHint} page content.`,
              `SOURCE URL: ${url}`,
              fetched.images.length > 0 ? `\nIMAGES FOUND ON PAGE (${fetched.images.length}):\n${fetched.images.join("\n")}` : "",
              `\n--- PAGE CONTENT START ---\n${fetched.text}\n--- PAGE CONTENT END ---`,
              `\nCRITICAL INSTRUCTIONS:`,
              `1. Extract ONLY data that ACTUALLY appears in the content above. Return JSON only.`,
              `2. DO NOT invent, fabricate, or guess ANY data. If something is NOT explicitly in the text, use null or empty array.`,
              `3. For amenities: ONLY list amenities that are EXPLICITLY mentioned in the text above. If an amenity is NOT mentioned, do NOT include it. An empty array [] is perfectly acceptable.`,
              `4. For price: look for numbers near ₪, ש"ח, שקל, NIS, שכירות, rent, להשכרה, or "price" fields in structured data.`,
              `5. For rooms: look for חדרים, חד', rooms, X.5 patterns, or "rooms" fields in structured data.`,
              `6. For sqm: look for מ"ר, מטר, sqm, m², or "area"/"size" fields in structured data.`,
              `7. For floor: look for קומה, floor, or floor/total patterns. Extract BOTH floor and total_floors.`,
              `8. For images: include ALL image URLs from the page that are property/listing photos. Include the IMAGES FOUND ON PAGE list above.`,
              `9. For contact: extract name, phone (Israeli patterns: 05X-XXXXXXX, 0X-XXXXXXX, +972).`,
              `10. For address: extract full street + number. For city: extract city name (preferably in Hebrew).`,
              `11. For description: clean up the text, remove HTML artifacts, provide the listing description.`,
              `\nAMENITIES LIST — Only include if EXPLICITLY found in text:`,
              `מעלית, חניה, מרפסת, מיזוג/מזגן, ממ"ד, מחסן, דוד שמש, סורגים, גישה לנכים, מזגן טורנדו, משופצת, ריהוט/מרוהטת, חיות מחמד, מתאים לשותפים, מטבח כשר, דלתות רב בריח, ארונות קיר, גינה, תריסים חשמליים, גז מרכזי`,
              ...sourceNotes,
            ].join("\n"),
          }];
        } else {
          console.warn(`[ai-assist] Could not fetch URL content (${fetched?.text.length ?? 0} chars). Sending URL for best-effort extraction.`);
          // If fetch failed, still tell the AI we couldn't get the content
          const sourceHint2 = url.includes("facebook") ? "Facebook Marketplace / Groups"
            : url.includes("yad2") ? "Yad2"
            : url.includes("madlan") ? "Madlan"
            : "a rental listing website";
          enrichedMessages = [{
            role: "user",
            content: [
              `I tried to fetch this rental listing URL but could not retrieve the page content: ${url}`,
              ``,
              `The URL appears to be from: ${sourceHint2}`,
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
      ? { maxTokens: 2000, temperature: 0.05, timeoutMs: 60000 }
      : type === "analyze"
      ? { maxTokens: 1200, temperature: 0.4 }
      : { maxTokens: 1024, temperature: 0.7 };

    // Use stronger models for extraction, standard for others
    const modelList = type === "extract" ? EXTRACT_MODELS : MODELS;

    // Try each model in priority order
    for (const model of modelList) {
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
