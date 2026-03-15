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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

/* ── City codes ── */
const CITY_CODES: Record<string, { id: number; label: string; topArea: number; area: number }> = {
  "tel-aviv":      { id: 5000, label: "תל אביב",      topArea: 2, area: 1 },
  "givatayim":     { id: 7900, label: "גבעתיים",       topArea: 2, area: 2 },
  "ramat-gan":     { id: 8300, label: "רמת גן",        topArea: 2, area: 2 },
  "holon":         { id: 6200, label: "חולון",          topArea: 2, area: 2 },
  "bat-yam":       { id: 6100, label: "בת ים",          topArea: 2, area: 2 },
  "bnei-brak":     { id: 6300, label: "בני ברק",        topArea: 2, area: 2 },
  "petah-tikva":   { id: 7400, label: "פתח תקווה",     topArea: 2, area: 7 },
  "herzliya":      { id: 6900, label: "הרצליה",         topArea: 2, area: 7 },
  "rishon":        { id: 8600, label: "ראשון לציון",    topArea: 2, area: 3 },
  "netanya":       { id: 7000, label: "נתניה",          topArea: 2, area: 7 },
  "raanana":       { id: 8200, label: "רעננה",          topArea: 2, area: 7 },
  "rehovot":       { id: 8400, label: "רחובות",         topArea: 2, area: 3 },
};

/* ── Yad2 item shape (all fields optional — API shape varies) ── */
interface Yad2Item {
  id?: string; token?: string; link_token?: string;
  address?: { street?: { text?: string }; house?: { text?: string }; neighborhood?: { text?: string } };
  street?: string; house_number?: string | number; neighborhood?: string;
  price?: number | string; rooms?: number | string; square_meters?: number | string;
  floor?: number | string; total_floors?: number | string; city_text?: string; city?: string;
  description_text?: string; info_text?: string; title?: string;
  air_conditioner?: boolean; parking?: boolean; elevator?: boolean;
  balcony?: boolean; furniture?: boolean | string; safe_room?: boolean; storage?: boolean;
  bars?: boolean; window_bars?: boolean;
  boiler?: boolean; solar_water_heater?: boolean;
  security_door?: boolean; pandoor?: boolean;
  electric_shutters?: boolean;
  central_gas?: boolean;
  built_in_closets?: boolean; closets?: boolean;
  renovated?: boolean;
  garden?: boolean;
  disabled_access?: boolean;
  underground_parking?: boolean;
  sun_balcony?: boolean;
  pets?: boolean; pets_allowed?: boolean;
  cover_image?: string; images?: Array<{ src?: string; url?: string }>;
  contact_name?: string; contact_phone?: string;
  updated_at?: string; created_at?: string; date?: string; date_added?: string;
  // Mobile API fields
  row_4?: string; row_1?: string; row_2?: string; row_3?: string;
  main_image?: string;
  // Additional image fields from various API versions
  img_url?: string;
  images_urls?: string[];
  media?: { images?: Array<{ src?: string; url?: string }> };
  image?: string;
  gallery?: Array<{ src?: string; url?: string }>;
  // Additional fields from newer API versions
  additional_info?: Record<string, boolean>;
  features?: Record<string, boolean | string>;
  amenities_list?: string[];
  // Price as text
  price_text?: string;
}

/** Sanitize phone numbers - only allow digits, spaces, dashes, parens, plus sign */
function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^\d\s+\-()]/g, "").trim();
  return cleaned.length >= 7 && cleaned.length <= 20 ? cleaned : null;
}

function normalizeItem(item: Yad2Item, cityLabel: string) {
  const street    = item.address?.street?.text ?? item.street ?? "";
  const houseNum  = item.address?.house?.text  ?? (item.house_number != null ? String(item.house_number) : "");
  const neighborhood = item.address?.neighborhood?.text ?? item.neighborhood ?? null;
  const address   = [street, houseNum].filter(Boolean).join(" ") || null;

  // Build Yad2 direct link — link_token → token → id → null
  const tokenId = item.link_token ?? item.token ?? item.id ?? null;
  const source_url = tokenId ? `https://www.yad2.co.il/item/${tokenId}` : null;

  const amenities: string[] = [];
  if (item.parking || item.underground_parking)  amenities.push("חניה");
  if (item.underground_parking)                  amenities.push("חניה תת-קרקעית");
  if (item.elevator)                             amenities.push("מעלית");
  if (item.balcony)                              amenities.push("מרפסת");
  if (item.sun_balcony)                          amenities.push("מרפסת שמש");
  if (item.air_conditioner)                      amenities.push("מיזוג");
  if (item.furniture)                            amenities.push("מרוהטת");
  if (item.safe_room)                            amenities.push('ממ"ד');
  if (item.storage)                              amenities.push("מחסן");
  if (item.bars || item.window_bars)             amenities.push("סורגים");
  if (item.boiler || item.solar_water_heater)    amenities.push("דוד שמש");
  if (item.security_door || item.pandoor)        amenities.push("דלת פלדלת");
  if (item.electric_shutters)                    amenities.push("תריסים חשמליים");
  if (item.central_gas)                          amenities.push("גז מרכזי");
  if (item.built_in_closets || item.closets)     amenities.push("ארונות קיר");
  if (item.renovated)                            amenities.push("משופצת");
  if (item.garden)                               amenities.push("גינה");
  if (item.disabled_access)                      amenities.push("גישה לנכים");
  // Also check additional_info and features objects
  if (item.additional_info) {
    const ai = item.additional_info;
    if ((ai.bars || ai.window_bars) && !amenities.includes("סורגים"))          amenities.push("סורגים");
    if ((ai.boiler || ai.solar_water_heater) && !amenities.includes("דוד שמש")) amenities.push("דוד שמש");
    if ((ai.pandoor || ai.security_door) && !amenities.includes("דלת פלדלת"))   amenities.push("דלת פלדלת");
    if (ai.renovated && !amenities.includes("משופצת"))                          amenities.push("משופצת");
  }
  if (item.amenities_list) {
    for (const a of item.amenities_list) {
      if (!amenities.includes(a)) amenities.push(a);
    }
  }

  // Check pets
  if (item.pets || item.pets_allowed)                amenities.push("חיות מחמד מותר");

  // Check features object for additional amenities
  if (item.features) {
    const f = item.features;
    if ((f.parking || f.underground_parking) && !amenities.includes("חניה"))     amenities.push("חניה");
    if (f.elevator && !amenities.includes("מעלית"))                               amenities.push("מעלית");
    if (f.balcony && !amenities.includes("מרפסת"))                               amenities.push("מרפסת");
    if ((f.air_conditioner || f.ac) && !amenities.includes("מיזוג"))             amenities.push("מיזוג");
    if ((f.furniture || f.furnished) && !amenities.includes("מרוהטת"))            amenities.push("מרוהטת");
    if ((f.safe_room || f.mamad) && !amenities.includes('ממ"ד'))                  amenities.push('ממ"ד');
    if (f.storage && !amenities.includes("מחסן"))                                amenities.push("מחסן");
  }

  // Extract best available cover image
  const coverImage = item.cover_image
    ?? item.main_image
    ?? item.img_url
    ?? item.image
    ?? item.images?.[0]?.src
    ?? item.images?.[0]?.url
    ?? item.media?.images?.[0]?.src
    ?? item.media?.images?.[0]?.url
    ?? item.gallery?.[0]?.src
    ?? item.gallery?.[0]?.url
    ?? (item.images_urls && item.images_urls.length > 0 ? item.images_urls[0] : null)
    ?? null;

  // Collect all image URLs
  const allImages: string[] = [];
  if (coverImage) allImages.push(coverImage);
  if (item.images) {
    for (const img of item.images) {
      const url = img.src ?? img.url;
      if (url && !allImages.includes(url)) allImages.push(url);
    }
  }
  if (item.media?.images) {
    for (const img of item.media.images) {
      const url = img.src ?? img.url;
      if (url && !allImages.includes(url)) allImages.push(url);
    }
  }
  if (item.gallery) {
    for (const img of item.gallery) {
      const url = img.src ?? img.url;
      if (url && !allImages.includes(url)) allImages.push(url);
    }
  }
  if (item.images_urls) {
    for (const url of item.images_urls) {
      if (url && !allImages.includes(url)) allImages.push(url);
    }
  }

  return {
    source_id: String(tokenId ?? Math.random()),
    source: "yad2" as const,
    source_url,
    address, neighborhood,
    city: item.city_text ?? item.city ?? cityLabel,
    price: typeof item.price === "number" ? item.price : (typeof item.price === "string" ? parseInt(item.price.replace(/[^\d]/g, ""), 10) || null : (item.price_text ? parseInt(item.price_text.replace(/[^\d]/g, ""), 10) || null : null)),
    rooms: item.rooms != null ? parseFloat(String(item.rooms)) : null,
    sqm: item.square_meters != null ? parseInt(String(item.square_meters), 10) : null,
    floor: item.floor != null ? parseInt(String(item.floor), 10) : null,
    total_floors: item.total_floors != null ? parseInt(String(item.total_floors), 10) : null,
    description: item.description_text ?? item.info_text ?? item.title ?? null,
    amenities,
    features: {
      parking: !!item.parking, balcony: !!item.balcony, elevator: !!item.elevator,
      airConditioning: !!item.air_conditioner, furnished: !!item.furniture,
      safeRoom: !!item.safe_room, storage: !!item.storage,
    },
    cover_image: coverImage,
    image_urls: allImages.slice(0, 10),
    contact_name: item.contact_name ? String(item.contact_name).slice(0, 200) : null,
    contact_phone: sanitizePhone(item.contact_phone),
    listed_at: item.updated_at ?? item.created_at ?? item.date ?? item.date_added ?? new Date().toISOString(),
  };
}

/* ── Extract feed items from any known Yad2 response shape ── */
function extractItems(json: unknown): Yad2Item[] {
  if (!json || typeof json !== "object") return [];
  const j = json as Record<string, unknown>;
  const candidates = [
    (j as any)?.data?.feed?.feed_items,
    (j as any)?.data?.feed?.items,
    (j as any)?.data?.listings,
    (j as any)?.data?.results,
    (j as any)?.feed_items,
    (j as any)?.data?.feed_items,
    (j as any)?.data?.items,
    (j as any)?.listings,
    (j as any)?.results,
    (j as any)?.items,
    (j as any)?.feed,
    (j as any)?.data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as Yad2Item[];
  }
  // Handle nested structures
  if ((j as any)?.data && typeof (j as any).data === "object") {
    const nested = extractItems((j as any).data);
    if (nested.length > 0) return nested;
  }
  return [];
}

/* ── Browser headers (desktop Chrome 124) ── */
const DESKTOP_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  "Origin": "https://www.yad2.co.il",
  "Referer": "https://www.yad2.co.il/realestate/rent",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "x-requested-with": "XMLHttpRequest",
};

/* ── Mobile app headers ── */
const MOBILE_HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "he-IL,he;q=0.9",
  "User-Agent": "Yad2/10.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/21E236",
  "x-app-version": "10.0",
  "x-platform": "ios",
};

/* ── Desktop v2 headers (alternate Chrome profile) ── */
const DESKTOP_V2_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9",
  "Cache-Control": "max-age=0",
  "Origin": "https://www.yad2.co.il",
  "Referer": "https://www.yad2.co.il/realestate/rent",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="123", "Google Chrome";v="123"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

async function tryFetch(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Yad2Item[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[yad2] ${res.status} from ${url}`);
      return [];
    }
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { return []; }
    return extractItems(json);
  } catch (e) {
    clearTimeout(timer);
    const name = (e as Error)?.name;
    if (name === "AbortError") console.warn(`[yad2] timeout: ${url}`);
    else console.warn(`[yad2] error: ${url}`, (e as Error)?.message);
    return [];
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCityListings(
  city: typeof CITY_CODES[string],
  params: Record<string, string>,
): Promise<ReturnType<typeof normalizeItem>[]> {
  const qs = new URLSearchParams({ ...params, compact: "1", forceLdLoad: "true" }).toString();
  const { id, topArea, area } = city;

  const attempts: Array<{ url: string; headers: Record<string, string> }> = [
    // Primary endpoints (known working patterns)
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&topArea=${topArea}&area=${area}&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&propertyGroup=apartments&${qs}`, headers: DESKTOP_V2_HEADERS },
    // Alternative API versions
    { url: `https://gw.yad2.co.il/search/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/realestate-feed/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_V2_HEADERS },
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&deal_type=rent&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&rows=40&${qs}`, headers: DESKTOP_V2_HEADERS },
    // Newer API versions
    { url: `https://gw.yad2.co.il/api/feed/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/api/v3/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/api/v2/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_V2_HEADERS },
    // Mobile API endpoints
    { url: `https://mobile-api.yad2.co.il/api/2/feed/realestate/rent?city=${id}&${qs}`, headers: MOBILE_HEADERS },
    { url: `https://mobile-api.yad2.co.il/api/3/realestate/rent?city=${id}&${qs}`, headers: MOBILE_HEADERS },
    // Fallback with page parameter
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&page=1&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&topArea=${topArea}&page=1&${qs}`, headers: DESKTOP_V2_HEADERS },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { url, headers } = attempts[i];
    const items = await tryFetch(url, headers, 12000);
    if (items.length > 0) {
      const valid = items
        .filter((item) => {
          // Accept items with a numeric price > 0, or a price_text that can be parsed
          if (typeof item.price === "number" && item.price > 0) return true;
          if (typeof item.price === "string" && parseInt(item.price.replace(/[^\d]/g, ""), 10) > 0) return true;
          if (item.price_text && parseInt(item.price_text.replace(/[^\d]/g, ""), 10) > 0) return true;
          return false;
        })
        .map((item) => normalizeItem(item, city.label));
      if (valid.length > 0) {
        console.log(`[yad2] ✓ ${valid.length} listings from ${url}`);
        return valid;
      }
    }
    if (i < attempts.length - 1) await delay(300);
  }

  console.warn(`[yad2] ✗ No listings for city ${city.label} (${city.id}) — all endpoints blocked`);
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json().catch(() => ({}));
    const raw = body as Record<string, unknown>;
    const VALID_CITIES = Object.keys(CITY_CODES);

    const cities = (Array.isArray(raw.cities) ? raw.cities : VALID_CITIES)
      .filter((c: unknown): c is string => typeof c === "string" && VALID_CITIES.includes(c))
      .slice(0, 5);

    const minPrice = typeof raw.minPrice === "number" && raw.minPrice >= 0 ? raw.minPrice : undefined;
    const maxPrice = typeof raw.maxPrice === "number" && raw.maxPrice <= 100000 ? raw.maxPrice : undefined;
    const minRooms = typeof raw.minRooms === "number" && raw.minRooms >= 0.5 ? raw.minRooms : undefined;
    const maxRooms = typeof raw.maxRooms === "number" && raw.maxRooms <= 20 ? raw.maxRooms : undefined;

    const params: Record<string, string> = {};
    if (minPrice != null || maxPrice != null) params.price = `${minPrice ?? 0}-${maxPrice ?? 99999}`;
    if (minRooms != null || maxRooms != null) params.rooms = `${minRooms ?? 1}-${maxRooms ?? 10}`;

    // Fetch cities in batches of 2 to avoid overwhelming Yad2
    const validCities = cities.filter((c) => CITY_CODES[c]);
    const allListings: ReturnType<typeof normalizeItem>[] = [];
    const BATCH_SIZE = 2;

    for (let i = 0; i < validCities.length; i += BATCH_SIZE) {
      const batch = validCities.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((c) => fetchCityListings(CITY_CODES[c], params))
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") allListings.push(...r.value);
      }
      if (i + BATCH_SIZE < validCities.length) await delay(500);
    }

    const listings = allListings.slice(0, 80);

    const unavailable = listings.length === 0;

    console.log(`[yad2] Returning ${listings.length} listings (unavailable=${unavailable})`);

    return new Response(
      JSON.stringify({
        listings,
        fetchedAt: new Date().toISOString(),
        unavailable,
        ...(unavailable ? {
          error: "Yad2 is temporarily blocking automated requests. Please try again in a few minutes.",
          errorHe: "יד2 חוסם בקשות אוטומטיות כרגע. נסו שוב בעוד מספר דקות.",
        } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[yad2] Fatal error:", err);
    return new Response(
      JSON.stringify({
        listings: [],
        fetchedAt: new Date().toISOString(),
        unavailable: true,
        error: "Scan service error. Please try again.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
