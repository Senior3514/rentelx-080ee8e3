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

// Yad2 city codes for Gush Dan area
const CITY_CODES: Record<string, { id: number; label: string }> = {
  "tel-aviv": { id: 5000, label: "תל אביב" },
  givatayim: { id: 7900, label: "גבעתיים" },
  "ramat-gan": { id: 8300, label: "רמת גן" },
};

interface Yad2Item {
  id?: string;
  token?: string;
  address?: { street?: { text?: string }; house?: { text?: string }; neighborhood?: { text?: string } };
  price?: number;
  rooms?: number | string;
  square_meters?: number | string;
  floor?: number | string;
  total_floors?: number | string;
  city_text?: string;
  description_text?: string;
  air_conditioner?: boolean;
  parking?: boolean;
  elevator?: boolean;
  balcony?: boolean;
  furniture?: boolean | string;
  safe_room?: boolean;
  storage?: boolean;
  cover_image?: string;
  images?: Array<{ src?: string }>;
  info_text?: string;
  contact_name?: string;
  contact_phone?: string;
  updated_at?: string;
  created_at?: string;
}

function normalizeItem(item: Yad2Item, cityLabel: string) {
  const street = item.address?.street?.text ?? "";
  const houseNum = item.address?.house?.text ?? "";
  const neighborhood = item.address?.neighborhood?.text ?? null;
  const address = [street, houseNum].filter(Boolean).join(" ") || null;

  const amenities: string[] = [];
  if (item.parking) amenities.push("חניה");
  if (item.elevator) amenities.push("מעלית");
  if (item.balcony) amenities.push("מרפסת");
  if (item.air_conditioner) amenities.push("מיזוג");
  if (item.furniture) amenities.push("מרוהטת");
  if (item.safe_room) amenities.push("ממ\"ד");
  if (item.storage) amenities.push("מחסן");

  return {
    source_id: String(item.id ?? item.token ?? Math.random()),
    source: "yad2" as const,
    address,
    neighborhood,
    city: item.city_text ?? cityLabel,
    price: typeof item.price === "number" ? item.price : null,
    rooms: item.rooms != null ? parseFloat(String(item.rooms)) : null,
    sqm: item.square_meters != null ? parseInt(String(item.square_meters), 10) : null,
    floor: item.floor != null ? parseInt(String(item.floor), 10) : null,
    total_floors: item.total_floors != null ? parseInt(String(item.total_floors), 10) : null,
    description: item.description_text ?? item.info_text ?? null,
    amenities,
    features: {
      parking: !!item.parking,
      balcony: !!item.balcony,
      elevator: !!item.elevator,
      airConditioning: !!item.air_conditioner,
      furnished: !!item.furniture,
      safeRoom: !!item.safe_room,
      storage: !!item.storage,
    },
    cover_image:
      item.cover_image ??
      item.images?.[0]?.src ??
      null,
    contact_name: item.contact_name ?? null,
    contact_phone: item.contact_phone ?? null,
    listed_at: item.updated_at ?? item.created_at ?? new Date().toISOString(),
  };
}

async function fetchYad2(cityId: number, cityLabel: string, params: Record<string, string>) {
  const qs = new URLSearchParams({
    city: String(cityId),
    ...params,
    // Return compact payload
    compact: "1",
  });

  const url = `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?${qs}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    console.error(`Yad2 fetch error for city ${cityId}: ${res.status}`);
    return [];
  }

  const json = await res.json();
  const items: Yad2Item[] =
    json?.data?.feed?.feed_items ??
    json?.data?.listings ??
    json?.feed_items ??
    [];

  return items
    .filter((item) => item.price && item.price > 0)
    .map((item) => normalizeItem(item, cityLabel));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

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
    if (minPrice != null || maxPrice != null) {
      params.price = `${minPrice ?? -1}-${maxPrice ?? -1}`;
    }
    if (minRooms != null || maxRooms != null) {
      params.rooms = `${minRooms ?? 1}-${maxRooms ?? 10}`;
    }

    const results = await Promise.all(
      cities
        .filter((c) => CITY_CODES[c])
        .map((c) => fetchYad2(CITY_CODES[c].id, CITY_CODES[c].label, params))
    );

    const listings = results.flat().slice(0, 60); // cap at 60

    return new Response(JSON.stringify({ listings, fetchedAt: new Date().toISOString() }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scan-yad2 error:", err);
    return new Response(
      JSON.stringify({ error: String(err), listings: [] }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
