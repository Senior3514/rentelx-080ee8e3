import { supabase } from "@/integrations/supabase/client";

export interface ScannedListing {
  source_id: string;
  source: "yad2";
  source_url: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  price: number | null;
  rooms: number | null;
  sqm: number | null;
  floor: number | null;
  total_floors: number | null;
  description: string | null;
  amenities: string[];
  features: {
    parking: boolean;
    balcony: boolean;
    elevator: boolean;
    airConditioning: boolean;
    furnished: boolean;
    safeRoom: boolean;
    storage: boolean;
  };
  cover_image: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  listed_at: string;
}

export type ScanCity =
  | "tel-aviv" | "givatayim" | "ramat-gan"
  | "holon" | "bat-yam" | "bnei-brak"
  | "petah-tikva" | "herzliya" | "rishon"
  | "netanya" | "raanana" | "rehovot";

export interface ScanParams {
  cities?: ScanCity[];
  minPrice?: number;
  maxPrice?: number;
  minRooms?: number;
  maxRooms?: number;
}

export interface ScanResult {
  listings: ScannedListing[];
  fetchedAt: string;
  unavailable?: boolean;
  error?: string;
}

/** Call the Supabase edge function that proxies Yad2 */
export async function scanYad2(params: ScanParams = {}): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke("scan-yad2", {
    body: {
      cities: params.cities ?? (["tel-aviv", "givatayim", "ramat-gan"] as ScanCity[]),
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRooms: params.minRooms,
      maxRooms: params.maxRooms,
    },
  });

  if (error) {
    return { listings: [], fetchedAt: new Date().toISOString(), error: error.message };
  }

  return data as ScanResult;
}

/** Score a scanned listing against a search profile criteria (0-100) */
export function scoreScannedListing(
  listing: ScannedListing,
  profile: {
    min_price?: number | null;
    max_price?: number | null;
    min_rooms?: number | null;
    max_rooms?: number | null;
    cities?: string[] | null;
  }
): number {
  let score = 60; // base

  // Price match
  if (listing.price) {
    if (profile.min_price && listing.price < profile.min_price) score -= 20;
    else if (profile.max_price && listing.price > profile.max_price) score -= 20;
    else score += 15;
  }

  // Rooms match
  if (listing.rooms) {
    if (profile.min_rooms && listing.rooms < profile.min_rooms) score -= 15;
    else if (profile.max_rooms && listing.rooms > profile.max_rooms) score -= 10;
    else score += 10;
  }

  // City match
  const cityNorm = listing.city.toLowerCase().replace(/\s/g, "-");
  if (profile.cities?.length) {
    const cityMatch = profile.cities.some(
      (c) =>
        c.toLowerCase().includes(cityNorm) ||
        cityNorm.includes(c.toLowerCase().replace(/\s/g, "-"))
    );
    if (cityMatch) score += 15;
    else score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/** Returns SCAN_KEY used in localStorage to track last scan time */
export const SCAN_KEY = (userId: string) => `rentelx_last_scan_${userId}`;
