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

const CITY_CODES: Record<string, { id: number; label: string }> = {
  "tel-aviv":  { id: 5000, label: "תל אביב" },
  "givatayim": { id: 7900, label: "גבעתיים" },
  "ramat-gan": { id: 8300, label: "רמת גן" },
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
}

function normalizeItem(item: Yad2Item, cityLabel: string) {
  const street = item.address?.street?.text ?? "";
  const houseNum = item.address?.house?.text ?? "";
  const neighborhood = item.address?.neighborhood?.text ?? null;
  const address = [street, houseNum].filter(Boolean).join(" ") || null;
  const amenities: string[] = [];
  if (item.parking)       amenities.push("חניה");
  if (item.elevator)      amenities.push("מעלית");
  if (item.balcony)       amenities.push("מרפסת");
  if (item.air_conditioner) amenities.push("מיזוג");
  if (item.furniture)     amenities.push("מרוהטת");
  if (item.safe_room)     amenities.push('ממ"ד');
  if (item.storage)       amenities.push("מחסן");
  return {
    source_id: String(item.id ?? item.token ?? Math.random()),
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

/* ── Try multiple Yad2 API endpoints ── */
const YAD2_URLS = [
  (cityId: number, qs: string) => `https://gw.yad2.co.il/feed-search-legacy/realestate/rent?city=${cityId}&${qs}`,
  (cityId: number, qs: string) => `https://gw.yad2.co.il/realestate/rent?city=${cityId}&${qs}`,
];

const BROWSER_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Origin": "https://www.yad2.co.il",
  "Referer": "https://www.yad2.co.il/realestate/rent",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120"',
  "sec-ch-ua-mobile": "?0",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

async function fetchYad2(cityId: number, cityLabel: string, params: Record<string, string>): Promise<ReturnType<typeof normalizeItem>[]> {
  const qs = new URLSearchParams({ ...params, compact: "1" }).toString();

  for (const urlFn of YAD2_URLS) {
    try {
      const url = urlFn(cityId, qs);
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) { console.warn(`Yad2 ${url} → ${res.status}`); continue; }
      const json = await res.json();
      const items: Yad2Item[] =
        json?.data?.feed?.feed_items ??
        json?.data?.listings ??
        json?.feed_items ??
        json?.data?.feed_items ??
        [];
      const valid = items.filter((item) => item.price && item.price > 0).map((item) => normalizeItem(item, cityLabel));
      if (valid.length > 0) return valid;
    } catch (e) {
      console.warn(`fetchYad2 attempt failed:`, e);
    }
  }
  return [];
}

/* ── Realistic fallback demo listings (shown when Yad2 is unreachable) ── */
function makeDemoListings(
  cities: string[],
  minPrice?: number,
  maxPrice?: number,
  minRooms?: number,
  maxRooms?: number
) {
  const now = new Date().toISOString();
  const ALL = [
    { source_id:"demo-1",source:"yad2"as const,address:"רוטשילד 45",neighborhood:"לב העיר",city:"תל אביב",price:7800,rooms:3,sqm:85,floor:4,total_floors:8,description:"דירה מרהיבה בלב רוטשילד, מרוהטת חלקית, שמש מלאה",amenities:["מעלית","מרפסת","מיזוג","חניה"],features:{parking:true,balcony:true,elevator:true,airConditioning:true,furnished:false,safeRoom:false,storage:false},cover_image:null,contact_name:"דן כהן",contact_phone:"052-1234567",listed_at:now},
    { source_id:"demo-2",source:"yad2"as const,address:"הרצל 22",neighborhood:"גבעת רמב\"ם",city:"גבעתיים",price:5200,rooms:2.5,sqm:70,floor:2,total_floors:6,description:"דירת 2.5 חדרים שקטה, קרובה לפארק",amenities:["מרפסת","מיזוג"],features:{parking:false,balcony:true,elevator:false,airConditioning:true,furnished:false,safeRoom:true,storage:false},cover_image:null,contact_name:"מירה לוי",contact_phone:"054-7654321",listed_at:now},
    { source_id:"demo-3",source:"yad2"as const,address:"ביאליק 8",neighborhood:"גבעת עליה",city:"רמת גן",price:5800,rooms:3,sqm:78,floor:3,total_floors:7,description:"דירה יפה, שיפוץ מלא 2023, קרובה לחינוך",amenities:["מעלית","מיזוג",'ממ"ד',"מחסן"],features:{parking:true,balcony:false,elevator:true,airConditioning:true,furnished:false,safeRoom:true,storage:true},cover_image:null,contact_name:"יוסי אברהם",contact_phone:"053-9876543",listed_at:now},
    { source_id:"demo-4",source:"yad2"as const,address:"דיזנגוף 120",neighborhood:"דיזנגוף",city:"תל אביב",price:8500,rooms:3.5,sqm:95,floor:6,total_floors:10,description:"דירה פנטהאוז, נוף עוצר נשימה, מרפסת גדולה",amenities:["מעלית","מרפסת","מיזוג","חניה","מרוהטת"],features:{parking:true,balcony:true,elevator:true,airConditioning:true,furnished:true,safeRoom:false,storage:false},cover_image:null,contact_name:"שרה גולד",contact_phone:"058-1112233",listed_at:now},
    { source_id:"demo-5",source:"yad2"as const,address:"אחד העם 55",neighborhood:"מרכז",city:"תל אביב",price:6400,rooms:2,sqm:58,floor:1,total_floors:4,description:"סטודיו גדול עם חצר פרטית, שקט ומרווח",amenities:["מרפסת","מיזוג"],features:{parking:false,balcony:true,elevator:false,airConditioning:true,furnished:false,safeRoom:false,storage:true},cover_image:null,contact_name:"עידן שמיר",contact_phone:"050-3344556",listed_at:now},
    { source_id:"demo-6",source:"yad2"as const,address:"ז'בוטינסקי 14",neighborhood:"מרכז",city:"רמת גן",price:4900,rooms:2.5,sqm:65,floor:2,total_floors:5,description:"דירת 2.5 חדרים, שיפוץ 2022, נוח לתחבורה",amenities:["מיזוג","מרפסת"],features:{parking:false,balcony:true,elevator:false,airConditioning:true,furnished:false,safeRoom:false,storage:false},cover_image:null,contact_name:"רחל ברק",contact_phone:"052-6677889",listed_at:now},
    { source_id:"demo-7",source:"yad2"as const,address:"קורנית 3",neighborhood:"קורנית",city:"גבעתיים",price:5600,rooms:3,sqm:80,floor:3,total_floors:6,description:"דירה מרווחת עם חדר עבודה, שקטה מאוד",amenities:["מעלית","מיזוג",'ממ"ד',"חניה"],features:{parking:true,balcony:false,elevator:true,airConditioning:true,furnished:false,safeRoom:true,storage:true},cover_image:null,contact_name:"אורי פרידמן",contact_phone:"054-5566778",listed_at:now},
    { source_id:"demo-8",source:"yad2"as const,address:"פינסקר 7",neighborhood:"לב העיר",city:"תל אביב",price:9200,rooms:4,sqm:110,floor:7,total_floors:12,description:"דירת 4 חדרים פרימיום, עיצוב מודרני, חניה כפולה",amenities:["מעלית","מרפסת","מיזוג","חניה","מחסן","מרוהטת"],features:{parking:true,balcony:true,elevator:true,airConditioning:true,furnished:true,safeRoom:true,storage:true},cover_image:null,contact_name:"נועה כץ",contact_phone:"055-9900112",listed_at:now},
  ];

  return ALL.filter((l) => {
    if (!cities.some((c) =>
      l.city.includes("תל אביב") ? c === "tel-aviv" :
      l.city.includes("גבעתיים") ? c === "givatayim" :
      l.city.includes("רמת גן") ? c === "ramat-gan" : false
    )) return false;
    if (minPrice && l.price < minPrice) return false;
    if (maxPrice && l.price > maxPrice) return false;
    if (minRooms && l.rooms < minRooms) return false;
    if (maxRooms && l.rooms > maxRooms) return false;
    return true;
  });
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
    if (minPrice != null || maxPrice != null) params.price = `${minPrice ?? 0}-${maxPrice ?? 999999}`;
    if (minRooms != null || maxRooms != null) params.rooms = `${minRooms ?? 1}-${maxRooms ?? 10}`;

    /* Try real Yad2 API with a 12s timeout */
    let listings: ReturnType<typeof normalizeItem>[] = [];
    let isDemo = false;

    try {
      const fetchTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 12000)
      );
      const fetchReal = Promise.all(
        cities.filter((c) => CITY_CODES[c]).map((c) => fetchYad2(CITY_CODES[c].id, CITY_CODES[c].label, params))
      );
      const results = await Promise.race([fetchReal, fetchTimeout]) as ReturnType<typeof normalizeItem>[][];
      listings = results.flat().slice(0, 60);
    } catch (e) {
      console.warn("Yad2 API unavailable, using demo data:", e);
    }

    /* Fallback to demo data when Yad2 returns nothing */
    if (listings.length === 0) {
      listings = makeDemoListings(cities, minPrice, maxPrice, minRooms, maxRooms);
      isDemo = true;
      console.log(`Serving ${listings.length} demo listings (Yad2 unavailable)`);
    }

    return new Response(
      JSON.stringify({ listings, fetchedAt: new Date().toISOString(), isDemo }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scan-yad2 fatal error:", err);
    /* Never return 5xx — always serve demo data */
    const fallback = makeDemoListings(["tel-aviv", "givatayim", "ramat-gan"]);
    return new Response(
      JSON.stringify({ listings: fallback, fetchedAt: new Date().toISOString(), isDemo: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
