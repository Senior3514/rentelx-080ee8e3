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
  };
}

const CITY_CODES: Record<string, { id: number; label: string; topArea: number; area: number }> = {
  "tel-aviv":  { id: 5000, label: "תל אביב",  topArea: 2, area: 1 },
  "givatayim": { id: 7900, label: "גבעתיים",   topArea: 2, area: 2 },
  "ramat-gan": { id: 8300, label: "רמת גן",    topArea: 2, area: 2 },
};

interface Yad2Item {
  id?: string; token?: string;
  address?: { street?: { text?: string }; house?: { text?: string }; neighborhood?: { text?: string } };
  price?: number; rooms?: number | string; square_meters?: number | string;
  floor?: number | string; total_floors?: number | string; city_text?: string;
  description_text?: string; info_text?: string;
  air_conditioner?: boolean; parking?: boolean; elevator?: boolean;
  balcony?: boolean; furniture?: boolean | string; safe_room?: boolean; storage?: boolean;
  cover_image?: string; images?: Array<{ src?: string }>;
  contact_name?: string; contact_phone?: string;
  updated_at?: string; created_at?: string;
  link_token?: string;
}

function normalizeItem(item: Yad2Item, cityLabel: string) {
  const street = item.address?.street?.text ?? "";
  const houseNum = item.address?.house?.text ?? "";
  const neighborhood = item.address?.neighborhood?.text ?? null;
  const address = [street, houseNum].filter(Boolean).join(" ") || null;
  const amenities: string[] = [];
  if (item.parking)         amenities.push("חניה");
  if (item.elevator)        amenities.push("מעלית");
  if (item.balcony)         amenities.push("מרפסת");
  if (item.air_conditioner) amenities.push("מיזוג");
  if (item.furniture)       amenities.push("מרוהטת");
  if (item.safe_room)       amenities.push('ממ"ד');
  if (item.storage)         amenities.push("מחסן");
  return {
    source_id: String(item.id ?? item.token ?? item.link_token ?? Math.random()),
    source: "yad2" as const,
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
    cover_image: item.cover_image ?? item.images?.[0]?.src ?? null,
    contact_name: item.contact_name ?? null,
    contact_phone: item.contact_phone ?? null,
    listed_at: item.updated_at ?? item.created_at ?? new Date().toISOString(),
  };
}

const BROWSER_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Origin": "https://www.yad2.co.il",
  "Referer": "https://www.yad2.co.il/realestate/rent",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "DNT": "1",
};

/** Build all candidate Yad2 API URLs to try for a city */
function buildUrls(city: typeof CITY_CODES[string], qs: URLSearchParams): string[] {
  const base = qs.toString();
  return [
    // Feed search legacy (main endpoint)
    `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${city.id}&${base}`,
    // Feed search with topArea + area
    `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?topArea=${city.topArea}&area=${city.area}&city=${city.id}&${base}`,
    // Direct realestate endpoint
    `https://gw.yad2.co.il/realestate/rent?city=${city.id}&${base}`,
    // Pre-load feed index
    `https://www.yad2.co.il/api/pre-load/getFeedIndex/realestate/rent?city=${city.id}&${base}`,
  ];
}

function extractItems(json: unknown): Yad2Item[] {
  if (!json || typeof json !== "object") return [];
  const j = json as Record<string, unknown>;
  // Try all known response shapes
  const candidates = [
    (j as any)?.data?.feed?.feed_items,
    (j as any)?.data?.listings,
    (j as any)?.feed_items,
    (j as any)?.data?.feed_items,
    (j as any)?.data?.items,
    (j as any)?.listings,
    (j as any)?.items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as Yad2Item[];
  }
  return [];
}

async function fetchCityListings(
  city: typeof CITY_CODES[string],
  params: Record<string, string>,
  timeoutMs: number,
): Promise<ReturnType<typeof normalizeItem>[]> {
  const qs = new URLSearchParams({ ...params, compact: "1", forceLdLoad: "true" });
  const urls = buildUrls(city, qs);

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        console.warn(`Yad2 ${res.status} for ${url}`);
        continue;
      }
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); } catch { continue; }

      const items = extractItems(json);
      if (items.length === 0) continue;

      const valid = items
        .filter((item) => item.price && item.price > 0)
        .map((item) => normalizeItem(item, city.label));

      if (valid.length > 0) {
        console.log(`Yad2 success: ${valid.length} listings from ${url}`);
        return valid;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        console.warn(`Yad2 timeout: ${url}`);
      } else {
        console.warn(`Yad2 fetch error for ${url}:`, e);
      }
    }
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json().catch(() => ({}));
    const raw = body as Record<string, unknown>;
    const VALID_CITIES = Object.keys(CITY_CODES);

    const cities = (Array.isArray(raw.cities) ? raw.cities : ["tel-aviv", "givatayim", "ramat-gan"])
      .filter((c: unknown): c is string => typeof c === "string" && VALID_CITIES.includes(c))
      .slice(0, 5);

    const minPrice = typeof raw.minPrice === "number" && raw.minPrice >= 0 && raw.minPrice <= 100000 ? raw.minPrice : undefined;
    const maxPrice = typeof raw.maxPrice === "number" && raw.maxPrice >= 0 && raw.maxPrice <= 100000 ? raw.maxPrice : undefined;
    const minRooms = typeof raw.minRooms === "number" && raw.minRooms >= 0.5 && raw.minRooms <= 20 ? raw.minRooms : undefined;
    const maxRooms = typeof raw.maxRooms === "number" && raw.maxRooms >= 0.5 && raw.maxRooms <= 20 ? raw.maxRooms : undefined;

    const params: Record<string, string> = {};
    if (minPrice != null || maxPrice != null) params.price = `${minPrice ?? 0}-${maxPrice ?? 99999}`;
    if (minRooms != null || maxRooms != null) params.rooms = `${minRooms ?? 1}-${maxRooms ?? 10}`;

    // Fetch from all requested cities in parallel (15s per city)
    const cityResults = await Promise.allSettled(
      cities
        .filter((c) => CITY_CODES[c])
        .map((c) => fetchCityListings(CITY_CODES[c], params, 15000))
    );

    const listings = cityResults
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .slice(0, 80);

    const unavailable = listings.length === 0;

    return new Response(
      JSON.stringify({
        listings,
        fetchedAt: new Date().toISOString(),
        unavailable,
        ...(unavailable ? { error: "Yad2 API did not return listings. Please try again shortly." } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scan-yad2 error:", err);
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
