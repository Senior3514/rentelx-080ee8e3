import { supabase } from "@/integrations/supabase/client";
import { scoreListing } from "@/lib/scoring";

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
  image_urls?: string[];
  contact_name: string | null;
  contact_phone: string | null;
  listed_at: string;
  _score?: number | null;
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
  try {
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
      console.warn("[scanYad2] Edge function error:", error.message);
      return { listings: [], fetchedAt: new Date().toISOString(), error: error.message };
    }

    if (!data || typeof data !== "object") {
      return { listings: [], fetchedAt: new Date().toISOString(), error: "Invalid response from scan service" };
    }

    return data as ScanResult;
  } catch (err: any) {
    console.error("[scanYad2] Network error:", err);
    return {
      listings: [],
      fetchedAt: new Date().toISOString(),
      error: err.message || "Network error during scan",
    };
  }
}

/** Score a scanned listing against a search profile using the full scoring engine (0-100) */
export function scoreScannedListing(
  listing: ScannedListing,
  profile: {
    min_price?: number | null;
    max_price?: number | null;
    min_rooms?: number | null;
    max_rooms?: number | null;
    cities?: string[] | null;
    must_haves?: string[] | null;
    nice_to_haves?: string[] | null;
    workplace_address?: string | null;
    current_address?: string | null;
    desired_area?: string | null;
  }
): number {
  // Use the full scoring engine for consistent scoring across the app
  const result = scoreListing(
    {
      city: listing.city,
      price: listing.price,
      rooms: listing.rooms,
      amenities: listing.amenities,
      neighborhood: listing.neighborhood,
      address: listing.address,
    },
    {
      cities: profile.cities || [],
      min_price: profile.min_price || 0,
      max_price: profile.max_price || 99999,
      min_rooms: profile.min_rooms || 0,
      max_rooms: profile.max_rooms || 99,
      must_haves: profile.must_haves || [],
      nice_to_haves: profile.nice_to_haves || [],
      workplace_address: profile.workplace_address,
      current_address: profile.current_address,
      desired_area: profile.desired_area,
    }
  );

  return result.total;
}

/** Returns SCAN_KEY used in localStorage to track last scan time */
export const SCAN_KEY = (userId: string) => `rentelx_last_scan_${userId}`;
