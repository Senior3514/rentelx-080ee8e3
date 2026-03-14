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
  price?: number; rooms?: number | string; square_meters?: number | string;
  floor?: number | string; total_floors?: number | string; city_text?: string;
  description_text?: string; info_text?: string;
  air_conditioner?: boolean; parking?: boolean; elevator?: boolean;
  balcony?: boolean; furniture?: boolean | string; safe_room?: boolean; storage?: boolean;
  cover_image?: string; images?: Array<{ src?: string }>;
  contact_name?: string; contact_phone?: string;
  updated_at?: string; created_at?: string;
  // Mobile API fields
  row_4?: string; row_1?: string; row_2?: string; row_3?: string;
  main_image?: string;
  // Additional image fields from various API versions
  img_url?: string;
  images_urls?: string[];
  media?: { images?: Array<{ src?: string; url?: string }> };
}

function normalizeItem(item: Yad2Item, cityLabel: string) {
  const street    = item.address?.street?.text ?? "";
  const houseNum  = item.address?.house?.text  ?? "";
  const neighborhood = item.address?.neighborhood?.text ?? null;
  const address   = [street, houseNum].filter(Boolean).join(" ") || null;

  // Build Yad2 direct link — link_token → token → id → null
  const tokenId = item.link_token ?? item.token ?? item.id ?? null;
  const source_url = tokenId ? `https://www.yad2.co.il/item/${tokenId}` : null;

  const amenities: string[] = [];
  if (item.parking)         amenities.push("חניה");
  if (item.elevator)        amenities.push("מעלית");
  if (item.balcony)         amenities.push("מרפסת");
  if (item.air_conditioner) amenities.push("מיזוג");
  if (item.furniture)       amenities.push("מרוהטת");
  if (item.safe_room)       amenities.push('ממ"ד');
  if (item.storage)         amenities.push("מחסן");

  // Extract best available cover image
  const coverImage = item.cover_image
    ?? item.main_image
    ?? item.img_url
    ?? item.images?.[0]?.src
    ?? item.media?.images?.[0]?.src
    ?? item.media?.images?.[0]?.url
    ?? (item.images_urls && item.images_urls.length > 0 ? item.images_urls[0] : null)
    ?? null;

  // Collect all image URLs
  const allImages: string[] = [];
  if (coverImage) allImages.push(coverImage);
  if (item.images) {
    for (const img of item.images) {
      if (img.src && !allImages.includes(img.src)) allImages.push(img.src);
    }
  }
  if (item.media?.images) {
    for (const img of item.media.images) {
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
    city: item.city_text ?? cityLabel,
    price: typeof item.price === "number" ? item.price : null,
    rooms: item.rooms != null ? parseFloat(String(item.rooms)) : null,
    sqm: item.square_meters != null ? parseInt(String(item.square_meters), 10) : null,
    floor: item.floor != null ? parseInt(String(item.floor), 10) : null,
    total_floors: item.total_floors != null ? parseInt(String(item.total_floors), 10) : null,
    description: item.description_text ?? item.info_text ?? null,
    amenities,
    features: {
      parking: !!item.parking, balcony: !!item.balcony, elevator: !!item.elevator,
      airConditioning: !!item.air_conditioner, furnished: !!item.furniture,
      safeRoom: !!item.safe_room, storage: !!item.storage,
    },
    cover_image: coverImage,
    image_urls: allImages.slice(0, 10),
    contact_name: item.contact_name ?? null,
    contact_phone: item.contact_phone ?? null,
    listed_at: item.updated_at ?? item.created_at ?? new Date().toISOString(),
  };
}

/* ── Extract feed items from any known Yad2 response shape ── */
function extractItems(json: unknown): Yad2Item[] {
  if (!json || typeof json !== "object") return [];
  const j = json as Record<string, unknown>;
  const candidates = [
    (j as any)?.data?.feed?.feed_items,
    (j as any)?.data?.listings,
    (j as any)?.feed_items,
    (j as any)?.data?.feed_items,
    (j as any)?.data?.items,
    (j as any)?.listings,
    (j as any)?.items,
    (j as any)?.data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as Yad2Item[];
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
};

/* ── Mobile app headers ── */
const MOBILE_HEADERS = {
  "Accept": "application/json",
  "Accept-Language": "he-IL,he;q=0.9",
  "User-Agent": "Yad2/10.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/21E236",
  "x-app-version": "10.0",
  "x-platform": "ios",
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
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?topArea=${topArea}&area=${area}&city=${id}&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${id}&propertyGroup=apartments&${qs}`, headers: DESKTOP_HEADERS },
    { url: `https://mobile-api.yad2.co.il/api/2/feed/realestate/rent?city=${id}&${qs}`, headers: MOBILE_HEADERS },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { url, headers } = attempts[i];
    const items = await tryFetch(url, headers, 10000);
    if (items.length > 0) {
      const valid = items
        .filter((item) => item.price && item.price > 0)
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
