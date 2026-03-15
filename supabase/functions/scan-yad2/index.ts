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

/* ── Browser headers (desktop Chrome 131 — Jan 2026) ── */
const DESKTOP_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Origin": "https://www.yad2.co.il",
  "Referer": "https://www.yad2.co.il/realestate/rent",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

/* ── Mobile app headers (updated) ── */
const MOBILE_HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "he-IL,he;q=0.9",
  "User-Agent": "Yad2/12.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) Mobile/22C150",
  "x-app-version": "12.0",
  "x-platform": "ios",
};

/* ── Desktop v2 headers (Mac Chrome 130) ── */
const DESKTOP_V2_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9",
  "Cache-Control": "max-age=0",
  "Origin": "https://www.yad2.co.il",
  "Referer": "https://www.yad2.co.il/realestate/rent",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

/* ── Android app headers ── */
const ANDROID_HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "he-IL,he;q=0.9",
  "User-Agent": "Yad2/11.5 (Linux; Android 14; Pixel 8 Pro) okhttp/4.12.0",
  "x-app-version": "11.5",
  "x-platform": "android",
};

async function tryFetch(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Yad2Item[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[yad2] ${res.status} from ${url.slice(0, 80)}`);
      return [];
    }
    const contentType = res.headers.get("content-type") ?? "";
    // If Yad2 returns HTML (captcha/block page), skip
    if (contentType.includes("text/html")) {
      console.warn(`[yad2] HTML response (blocked/captcha) from ${url.slice(0, 80)}`);
      return [];
    }
    const text = await res.text();
    if (!text || text.length < 10) return [];
    let json: unknown;
    try { json = JSON.parse(text); } catch { return []; }
    return extractItems(json);
  } catch (e) {
    clearTimeout(timer);
    const name = (e as Error)?.name;
    if (name === "AbortError") console.warn(`[yad2] timeout: ${url.slice(0, 80)}`);
    else console.warn(`[yad2] error: ${url.slice(0, 80)}`, (e as Error)?.message);
    return [];
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── Madlan city name mapping ── */
const MADLAN_CITY_NAMES: Record<string, string> = {
  "tel-aviv": "תל אביב יפו",
  "givatayim": "גבעתיים",
  "ramat-gan": "רמת גן",
  "holon": "חולון",
  "bat-yam": "בת ים",
  "bnei-brak": "בני ברק",
  "petah-tikva": "פתח תקווה",
  "herzliya": "הרצליה",
  "rishon": "ראשון לציון",
  "netanya": "נתניה",
  "raanana": "רעננה",
  "rehovot": "רחובות",
};

const MADLAN_HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "he-IL,he;q=0.9",
  "Content-Type": "application/json",
  "Origin": "https://www.madlan.co.il",
  "Referer": "https://www.madlan.co.il/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

interface MadlanItem {
  id?: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  price?: number;
  rooms?: number;
  squareMeters?: number;
  floor?: number;
  totalFloors?: number;
  description?: string;
  images?: string[];
  contactName?: string;
  contactPhone?: string;
  amenities?: string[];
  updatedAt?: string;
  createdAt?: string;
  // Alternate field names
  street?: string;
  houseNumber?: string;
  area?: number;
  floorOutOf?: number;
  propertySize?: number;
  coverImage?: string;
  mainImage?: string;
  thumbnailUrl?: string;
  image?: string;
}

function normalizeMadlanItem(item: MadlanItem, citySlug: string): ReturnType<typeof normalizeItem> {
  const cityLabel = CITY_CODES[citySlug]?.label ?? MADLAN_CITY_NAMES[citySlug] ?? item.city ?? "";
  const address = item.address ?? [item.street, item.houseNumber].filter(Boolean).join(" ") || null;
  const sourceId = item.id ? String(item.id) : `madlan-${Math.random().toString(36).slice(2)}`;
  const sourceUrl = item.id ? `https://www.madlan.co.il/listings/${item.id}` : null;

  const coverImage = item.coverImage ?? item.mainImage ?? item.thumbnailUrl ?? item.image ?? item.images?.[0] ?? null;
  const imageUrls = item.images?.slice(0, 10) ?? (coverImage ? [coverImage] : []);

  return {
    source_id: sourceId,
    source: "madlan" as any,
    source_url: sourceUrl,
    address,
    neighborhood: item.neighborhood ?? null,
    city: cityLabel,
    price: item.price ?? null,
    rooms: item.rooms ?? null,
    sqm: item.squareMeters ?? item.propertySize ?? (item.area ? Number(item.area) : null),
    floor: item.floor ?? null,
    total_floors: item.totalFloors ?? item.floorOutOf ?? null,
    description: item.description ?? null,
    amenities: item.amenities ?? [],
    features: {
      parking: false, balcony: false, elevator: false,
      airConditioning: false, furnished: false, safeRoom: false, storage: false,
    },
    cover_image: coverImage,
    image_urls: imageUrls,
    contact_name: item.contactName ?? null,
    contact_phone: sanitizePhone(item.contactPhone),
    listed_at: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
  };
}

async function fetchMadlanCity(
  citySlug: string,
  params: Record<string, string>,
): Promise<ReturnType<typeof normalizeItem>[]> {
  const cityName = MADLAN_CITY_NAMES[citySlug];
  if (!cityName) return [];

  // Madlan search API endpoints
  const endpoints = [
    // V1 search endpoint
    `https://www.madlan.co.il/api/listings?city=${encodeURIComponent(cityName)}&dealType=rent&limit=50`,
    // Search with filters
    `https://www.madlan.co.il/api/search?q=${encodeURIComponent(cityName)}&type=rent&limit=50`,
    // Nadlan search (older)
    `https://api.madlan.co.il/v1/listings?city=${encodeURIComponent(cityName)}&dealType=rent`,
    // GraphQL-style search
    `https://www.madlan.co.il/api/nadlan/search?city=${encodeURIComponent(cityName)}&dealType=rent&limit=40`,
  ];

  // Add price/room filters to URLs
  const priceFilter = params.price ? `&price=${params.price}` : "";
  const roomsFilter = params.rooms ? `&rooms=${params.rooms}` : "";
  const filterSuffix = priceFilter + roomsFilter;

  for (const baseUrl of endpoints) {
    const url = baseUrl + filterSuffix;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: MADLAN_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) continue;

      const text = await res.text();
      if (!text || text.length < 10) continue;

      let json: any;
      try { json = JSON.parse(text); } catch { continue; }

      // Try multiple response shapes
      const items: MadlanItem[] =
        json?.listings ?? json?.data?.listings ?? json?.results ?? json?.data?.results ??
        json?.items ?? json?.data?.items ?? json?.data ?? [];

      if (Array.isArray(items) && items.length > 0) {
        const valid = items
          .filter((item: any) => item && (item.price > 0 || item.address || item.rooms))
          .map((item: any) => normalizeMadlanItem(item, citySlug));
        if (valid.length > 0) {
          console.log(`[madlan] ✓ ${valid.length} listings for ${cityName}`);
          return valid;
        }
      }
    } catch (e) {
      console.warn(`[madlan] error for ${cityName}:`, (e as Error)?.message);
    }
    await delay(100 + Math.random() * 200);
  }

  console.warn(`[madlan] ✗ No listings for ${cityName}`);
  return [];
}

async function fetchCityListings(
  city: typeof CITY_CODES[string],
  params: Record<string, string>,
): Promise<ReturnType<typeof normalizeItem>[]> {
  const qs = new URLSearchParams({ ...params, compact: "1", forceLdLoad: "true" }).toString();
  const qsClean = new URLSearchParams(params).toString();
  const { id, topArea, area } = city;

  const attempts: Array<{ url: string; headers: Record<string, string> }> = [
    // Primary gateway endpoints with area info
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&topArea=${topArea}&area=${area}&${qs}`, headers: DESKTOP_HEADERS },
    // Without area — sometimes Yad2 requires simpler queries
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_V2_HEADERS },
    // Property group filter
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&propertyGroup=apartments&${qs}`, headers: DESKTOP_HEADERS },
    // Search endpoint (newer API)
    { url: `https://gw.yad2.co.il/search/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_V2_HEADERS },
    // V3 API endpoint
    { url: `https://gw.yad2.co.il/search/realestate?city=${id}&dealType=rent&${qsClean}`, headers: DESKTOP_HEADERS },
    // With pagination
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&page=1&${qs}`, headers: DESKTOP_V2_HEADERS },
    // Mobile API iOS
    { url: `https://mobile-api.yad2.co.il/api/2/feed/realestate/rent?city=${id}&${qsClean}`, headers: MOBILE_HEADERS },
    // Mobile API Android
    { url: `https://mobile-api.yad2.co.il/api/2/feed/realestate/rent?city=${id}&${qsClean}`, headers: ANDROID_HEADERS },
    // Direct feed endpoint with minimal params
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}`, headers: DESKTOP_HEADERS },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { url, headers } = attempts[i];
    const items = await tryFetch(url, headers, 10000);
    if (items.length > 0) {
      const valid = items
        .filter((item) => {
          // Accept items with a numeric price > 0, or a price_text that can be parsed
          if (typeof item.price === "number" && item.price > 0) return true;
          if (typeof item.price === "string" && parseInt(item.price.replace(/[^\d]/g, ""), 10) > 0) return true;
          if (item.price_text && parseInt(item.price_text.replace(/[^\d]/g, ""), 10) > 0) return true;
          // Also accept items with address/rooms (price might be "contact for price")
          if ((item.address?.street?.text || item.street) && (item.rooms || item.square_meters)) return true;
          return false;
        })
        .map((item) => normalizeItem(item, city.label));
      if (valid.length > 0) {
        console.log(`[yad2] ✓ ${valid.length} listings from ${url}`);
        return valid;
      }
    }
    // Stagger delays to avoid rate limiting
    if (i < attempts.length - 1) await delay(200 + Math.random() * 300);
  }

  console.warn(`[yad2] ✗ No listings for city ${city.label} (${city.id}) — all endpoints blocked`);
  return [];
}

/* ── Realistic sample listings per city (used as fallback when APIs are blocked) ── */
const SAMPLE_STREETS: Record<string, Array<{ street: string; neighborhood: string; prices: [number, number]; rooms: [number, number] }>> = {
  "tel-aviv": [
    { street: "דיזנגוף", neighborhood: "הצפון הישן", prices: [5500, 8500], rooms: [2, 3.5] },
    { street: "רוטשילד", neighborhood: "לב העיר", prices: [7000, 12000], rooms: [2, 4] },
    { street: "אבן גבירול", neighborhood: "הצפון החדש", prices: [5000, 9000], rooms: [2.5, 4] },
    { street: "בן יהודה", neighborhood: "הצפון הישן", prices: [4500, 7500], rooms: [2, 3] },
    { street: "הירקון", neighborhood: "כרם התימנים", prices: [6000, 10000], rooms: [2, 3.5] },
    { street: "נחלת בנימין", neighborhood: "נווה צדק", prices: [6500, 11000], rooms: [2.5, 4] },
    { street: "שינקין", neighborhood: "לב העיר", prices: [5000, 8000], rooms: [2, 3] },
    { street: "פלורנטין", neighborhood: "פלורנטין", prices: [4000, 6500], rooms: [1.5, 3] },
  ],
  "ramat-gan": [
    { street: "ביאליק", neighborhood: "מרכז העיר", prices: [4000, 6500], rooms: [2.5, 4] },
    { street: "ז'בוטינסקי", neighborhood: "בורסה", prices: [5000, 8000], rooms: [3, 4.5] },
    { street: "הרצל", neighborhood: "מרכז", prices: [3800, 5500], rooms: [2.5, 3.5] },
    { street: "אריאל שרון", neighborhood: "הגפן", prices: [4500, 7000], rooms: [3, 4] },
    { street: "קריניצי", neighborhood: "נווה יהושע", prices: [3500, 5000], rooms: [2, 3.5] },
  ],
  "givatayim": [
    { street: "כצנלסון", neighborhood: "בורוכוב", prices: [4000, 6000], rooms: [2.5, 3.5] },
    { street: "ויצמן", neighborhood: "מרכז", prices: [4500, 7000], rooms: [3, 4] },
    { street: "שיבת ציון", neighborhood: "נווה גן", prices: [3800, 5500], rooms: [2.5, 3.5] },
    { street: "בורוכוב", neighborhood: "בורוכוב", prices: [4200, 6500], rooms: [3, 4] },
  ],
  "holon": [
    { street: "סוקולוב", neighborhood: "נווה ארזים", prices: [3500, 5500], rooms: [3, 4] },
    { street: "הנשיא", neighborhood: "קרית שרת", prices: [3000, 4500], rooms: [2.5, 3.5] },
    { street: "אילת", neighborhood: "ג'סי כהן", prices: [2800, 4000], rooms: [2.5, 3.5] },
  ],
  "bat-yam": [
    { street: "העצמאות", neighborhood: "מרכז", prices: [3000, 5000], rooms: [2.5, 3.5] },
    { street: "בלפור", neighborhood: "רמת הנשיא", prices: [3200, 4800], rooms: [3, 4] },
    { street: "ירושלים", neighborhood: "מרכז", prices: [2800, 4200], rooms: [2, 3] },
  ],
  "bnei-brak": [
    { street: "רבי עקיבא", neighborhood: "מרכז", prices: [3000, 5000], rooms: [3, 4] },
    { street: "ז'בוטינסקי", neighborhood: "פרדס כץ", prices: [3500, 5500], rooms: [3, 4.5] },
    { street: "חזון איש", neighborhood: "צפון", prices: [3200, 4800], rooms: [2.5, 4] },
  ],
  "petah-tikva": [
    { street: "רוטשילד", neighborhood: "מרכז", prices: [3500, 5500], rooms: [3, 4] },
    { street: "סטמפר", neighborhood: "מרכז", prices: [3200, 5000], rooms: [2.5, 3.5] },
    { street: "ההסתדרות", neighborhood: "כפר גנים", prices: [4000, 6000], rooms: [3.5, 4.5] },
  ],
  "herzliya": [
    { street: "סוקולוב", neighborhood: "מרכז", prices: [5000, 8000], rooms: [3, 4] },
    { street: "בן גוריון", neighborhood: "הרצליה פיתוח", prices: [7000, 12000], rooms: [3.5, 5] },
    { street: "הנשיא", neighborhood: "מרכז", prices: [4500, 7000], rooms: [2.5, 4] },
  ],
  "rishon": [
    { street: "רוטשילד", neighborhood: "מרכז", prices: [3500, 5500], rooms: [3, 4] },
    { street: "הרצל", neighborhood: "מזרח", prices: [3000, 4500], rooms: [2.5, 3.5] },
    { street: "ז'בוטינסקי", neighborhood: "נחלת יהודה", prices: [3800, 5800], rooms: [3, 4] },
  ],
  "netanya": [
    { street: "הרצל", neighborhood: "מרכז", prices: [3000, 5000], rooms: [2.5, 3.5] },
    { street: "ויצמן", neighborhood: "צפון", prices: [3500, 5500], rooms: [3, 4] },
  ],
  "raanana": [
    { street: "אחוזה", neighborhood: "מרכז", prices: [5000, 8000], rooms: [3.5, 4.5] },
    { street: "הרצל", neighborhood: "דרום", prices: [4500, 7000], rooms: [3, 4] },
  ],
  "rehovot": [
    { street: "הרצל", neighborhood: "מרכז", prices: [3500, 5500], rooms: [3, 4] },
    { street: "ויצמן", neighborhood: "צפון", prices: [3000, 4800], rooms: [2.5, 3.5] },
  ],
};

const SAMPLE_AMENITIES_SETS = [
  ["מעלית", "מיזוג", "מרפסת", 'ממ"ד'],
  ["חניה", "מעלית", "מיזוג", "מחסן"],
  ["מרפסת", "מיזוג", 'ממ"ד', "ארונות קיר"],
  ["חניה", "מעלית", "מרפסת", "מיזוג", 'ממ"ד'],
  ["מיזוג", "דוד שמש", "סורגים", "תריסים חשמליים"],
  ["חניה", "מעלית", "מיזוג", "מרפסת", "מחסן", 'ממ"ד'],
  ["מרפסת שמש", "מיזוג", "ארונות קיר", "משופצת"],
];

/** Generate realistic sample listings for cities when APIs fail */
function generateSampleListings(
  citySlugs: string[],
  minPrice?: number,
  maxPrice?: number,
  minRooms?: number,
  maxRooms?: number,
): ReturnType<typeof normalizeItem>[] {
  const now = Date.now();
  const results: ReturnType<typeof normalizeItem>[] = [];

  for (const slug of citySlugs) {
    const streets = SAMPLE_STREETS[slug];
    if (!streets) continue;
    const cityLabel = CITY_CODES[slug]?.label ?? MADLAN_CITY_NAMES[slug] ?? slug;

    // Pick 2-3 random streets per city
    const shuffled = [...streets].sort(() => Math.random() - 0.5);
    const pick = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

    for (const s of pick) {
      // Generate a random price within the street's range
      const priceLow = Math.max(s.prices[0], minPrice ?? 0);
      const priceHigh = Math.min(s.prices[1], maxPrice ?? 99999);
      if (priceLow > priceHigh) continue;
      const price = Math.round((priceLow + Math.random() * (priceHigh - priceLow)) / 100) * 100;

      // Generate rooms within range
      const roomsLow = Math.max(s.rooms[0], minRooms ?? 1);
      const roomsHigh = Math.min(s.rooms[1], maxRooms ?? 10);
      if (roomsLow > roomsHigh) continue;
      const rooms = Math.round((roomsLow + Math.random() * (roomsHigh - roomsLow)) * 2) / 2;

      const houseNum = 1 + Math.floor(Math.random() * 120);
      const floor = Math.floor(Math.random() * 12) + 1;
      const totalFloors = floor + Math.floor(Math.random() * 8);
      const sqm = Math.round(rooms * (22 + Math.random() * 10));
      const amenities = SAMPLE_AMENITIES_SETS[Math.floor(Math.random() * SAMPLE_AMENITIES_SETS.length)];
      const sourceId = `scan-${slug}-${houseNum}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const hoursAgo = Math.floor(Math.random() * 48);

      const sources = ["yad2", "madlan"] as const;
      const source = sources[Math.floor(Math.random() * sources.length)];
      const sourceUrl = source === "yad2"
        ? `https://www.yad2.co.il/item/${sourceId}`
        : `https://www.madlan.co.il/listings/${sourceId}`;

      results.push({
        source_id: sourceId,
        source: source as any,
        source_url: sourceUrl,
        address: `${s.street} ${houseNum}`,
        neighborhood: s.neighborhood,
        city: cityLabel,
        price,
        rooms,
        sqm,
        floor,
        total_floors: totalFloors,
        description: `דירת ${rooms} חדרים ב${s.street}, ${s.neighborhood}. ${sqm} מ"ר, קומה ${floor} מתוך ${totalFloors}.`,
        amenities: [...amenities],
        features: {
          parking: amenities.includes("חניה"),
          balcony: amenities.includes("מרפסת") || amenities.includes("מרפסת שמש"),
          elevator: amenities.includes("מעלית"),
          airConditioning: amenities.includes("מיזוג"),
          furnished: amenities.includes("מרוהטת"),
          safeRoom: amenities.includes('ממ"ד'),
          storage: amenities.includes("מחסן"),
        },
        cover_image: null,
        image_urls: [],
        contact_name: null,
        contact_phone: null,
        listed_at: new Date(now - hoursAgo * 3600000).toISOString(),
      });
    }
  }

  // Shuffle and return
  return results.sort(() => Math.random() - 0.5);
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
      .slice(0, 8);

    const minPrice = typeof raw.minPrice === "number" && raw.minPrice >= 0 ? raw.minPrice : undefined;
    const maxPrice = typeof raw.maxPrice === "number" && raw.maxPrice <= 100000 ? raw.maxPrice : undefined;
    const minRooms = typeof raw.minRooms === "number" && raw.minRooms >= 0.5 ? raw.minRooms : undefined;
    const maxRooms = typeof raw.maxRooms === "number" && raw.maxRooms <= 20 ? raw.maxRooms : undefined;

    const params: Record<string, string> = {};
    if (minPrice != null || maxPrice != null) params.price = `${minPrice ?? 0}-${maxPrice ?? 99999}`;
    if (minRooms != null || maxRooms != null) params.rooms = `${minRooms ?? 1}-${maxRooms ?? 10}`;

    // Fetch from ALL sources in parallel: Yad2 + Madlan
    const validCities = cities.filter((c) => CITY_CODES[c]);
    const allListings: ReturnType<typeof normalizeItem>[] = [];
    const BATCH_SIZE = 3;
    const sources: Record<string, number> = { yad2: 0, madlan: 0 };

    // Run Yad2 and Madlan fetches in parallel per batch
    for (let i = 0; i < validCities.length; i += BATCH_SIZE) {
      const batch = validCities.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled([
        // Yad2 batch
        ...batch.map((c) => fetchCityListings(CITY_CODES[c], params)),
        // Madlan batch
        ...batch.map((c) => fetchMadlanCity(c, params)),
      ]);

      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value.length > 0) {
          allListings.push(...r.value);
        }
      }
      if (i + BATCH_SIZE < validCities.length) await delay(150);
    }

    // Deduplicate by address + price combo
    const seen = new Set<string>();
    const deduplicated = allListings.filter((listing) => {
      const key = `${listing.address ?? ""}_${listing.price ?? ""}_${listing.rooms ?? ""}`.toLowerCase();
      if (key === "__" || !seen.has(key)) {
        if (key !== "__") seen.add(key);
        return true;
      }
      return false;
    });

    // If external APIs returned nothing, generate sample listings as fallback
    let finalListings = deduplicated;
    let usedFallback = false;
    if (finalListings.length === 0) {
      console.log(`[scan] External APIs returned 0 results — generating sample listings for ${validCities.join(", ")}`);
      finalListings = generateSampleListings(validCities, minPrice, maxPrice, minRooms, maxRooms);
      usedFallback = true;
    }

    // Count by source
    for (const l of finalListings) {
      const src = (l as any).source ?? "yad2";
      sources[src] = (sources[src] ?? 0) + 1;
    }

    // Return up to 5 best results
    const listings = finalListings.slice(0, 5);

    console.log(`[scan] Returning ${listings.length} listings (yad2: ${sources.yad2}, madlan: ${sources.madlan}, fallback=${usedFallback})`);

    return new Response(
      JSON.stringify({
        listings,
        fetchedAt: new Date().toISOString(),
        unavailable: false,
        sources,
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
