/**
 * Yad2 Data Integration Service
 *
 * Parses and normalizes data from Yad2 listing URLs.
 * Since Yad2 doesn't have a public API, we provide:
 * 1. A structured data schema that matches Yad2 listings
 * 2. A URL parser/validator for Yad2 links
 * 3. Mock data for development/demo with realistic Israeli property listings
 */

export interface Yad2Listing {
  id: string;
  source: "yad2" | "madlan" | "facebook" | "manual" | "other";
  address: string | null;
  neighborhood: string | null;
  city: string;
  price: number;
  rooms: number;
  sqm: number;
  floor: number | null;
  totalFloors: number | null;
  amenities: string[];
  description: string;
  contactName: string | null;
  contactPhone: string | null;
  imageUrls: string[];
  postedAt: string;
  sourceUrl: string | null;
  /** Parking, balcony, elevator, renovated, furnished flags */
  features: {
    parking: boolean;
    balcony: boolean;
    elevator: boolean;
    renovated: boolean;
    furnished: boolean;
    safeRoom: boolean;
    storage: boolean;
    airConditioning: boolean;
    garden: boolean;
  };
}

/** Detect if a URL is from Yad2 */
export function isYad2Url(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("yad2.co.il");
  } catch {
    return false;
  }
}

/** Detect the listing source from URL */
export function detectSource(url: string): Yad2Listing["source"] {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("yad2.co.il")) return "yad2";
    if (hostname.includes("madlan.co.il")) return "madlan";
    if (hostname.includes("facebook.com") || hostname.includes("fb.com") || hostname.includes("mbasic.facebook.com")) return "facebook";
    return "other";
  } catch {
    return "other";
  }
}

/** Extract Yad2 listing ID from URL */
export function extractYad2Id(url: string): string | null {
  try {
    const match = url.match(/item\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Mock Yad2 listings for development/demo.
 * All data is fictional but representative of real Israeli rental market.
 */
export const MOCK_YAD2_LISTINGS: Yad2Listing[] = [
  {
    id: "yad2-001",
    source: "yad2",
    address: "רוטשילד 45",
    neighborhood: "לב תל אביב",
    city: "תל אביב",
    price: 6800,
    rooms: 3,
    sqm: 85,
    floor: 3,
    totalFloors: 6,
    amenities: ["ממ\"ד", "מעלית", "חניה", "מרפסת", "מיזוג אוויר"],
    description: "דירה מרווחת ומוארת עם נוף לרחוב רוטשילד. שיפוץ חדש, מטבח מאובזר, 2 חדרי שינה + סלון גדול.",
    contactName: "דני כהן",
    contactPhone: "052-1234567",
    imageUrls: [],
    postedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    sourceUrl: "https://www.yad2.co.il/item/abc123",
    features: { parking: true, balcony: true, elevator: true, renovated: true, furnished: false, safeRoom: true, storage: true, airConditioning: true, garden: false },
  },
  {
    id: "yad2-002",
    source: "yad2",
    address: "בן יהודה 12",
    neighborhood: "צפון תל אביב",
    city: "תל אביב",
    price: 5400,
    rooms: 2.5,
    sqm: 72,
    floor: 2,
    totalFloors: 4,
    amenities: ["מיזוג אוויר", "מרפסת", "אחסון"],
    description: "דירת 2.5 חדרים קרובה לים. בניין מטופח, חדר שינה מרוחק. אידיאלי לזוג.",
    contactName: "משרד נכסים ABC",
    contactPhone: "03-9876543",
    imageUrls: [],
    postedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    sourceUrl: "https://www.yad2.co.il/item/def456",
    features: { parking: false, balcony: true, elevator: false, renovated: false, furnished: false, safeRoom: false, storage: true, airConditioning: true, garden: false },
  },
  {
    id: "yad2-003",
    source: "yad2",
    address: "שדרות בן גוריון 7",
    neighborhood: "גבעת שמואל",
    city: "גבעת שמואל",
    price: 4900,
    rooms: 4,
    sqm: 110,
    floor: 1,
    totalFloors: 3,
    amenities: ["חניה", "גינה", "ממ\"ד", "מיזוג אוויר", "מחסן"],
    description: "דירת 4 חדרים עם גינה פרטית. שכונה שקטה, קרובה לבתי ספר וגנים. חניה צמודה.",
    contactName: "רחל לוי",
    contactPhone: "054-7654321",
    imageUrls: [],
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    sourceUrl: "https://www.yad2.co.il/item/ghi789",
    features: { parking: true, balcony: false, elevator: false, renovated: false, furnished: false, safeRoom: true, storage: true, airConditioning: true, garden: true },
  },
  {
    id: "yad2-004",
    source: "madlan",
    address: "ויצמן 34",
    neighborhood: "מרכז העיר",
    city: "ראשון לציון",
    price: 4200,
    rooms: 3.5,
    sqm: 95,
    floor: 4,
    totalFloors: 8,
    amenities: ["מעלית", "חניה תת קרקעית", "ממ\"ד", "מרפסת", "מיזוג אוויר"],
    description: "דירה בבניין חדש עם מעלית, חניה מובטחת, מרפסת עם נוף לעיר.",
    contactName: "יוסי אברהם",
    contactPhone: "050-3456789",
    imageUrls: [],
    postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    sourceUrl: "https://www.madlan.co.il/listing/xyz789",
    features: { parking: true, balcony: true, elevator: true, renovated: true, furnished: false, safeRoom: true, storage: false, airConditioning: true, garden: false },
  },
  {
    id: "yad2-005",
    source: "yad2",
    address: "הרצל 88",
    neighborhood: "כרמל",
    city: "חיפה",
    price: 3800,
    rooms: 3,
    sqm: 80,
    floor: 3,
    totalFloors: 5,
    amenities: ["מעלית", "מרפסת עם נוף לים", "מיזוג אוויר"],
    description: "דירה עם נוף מדהים לים כרמל. שיפוץ חלקי, מרפסת ענקית. קרוב לתחבורה ציבורית.",
    contactName: null,
    contactPhone: "072-5551234",
    imageUrls: [],
    postedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    sourceUrl: "https://www.yad2.co.il/item/jkl012",
    features: { parking: false, balcony: true, elevator: true, renovated: false, furnished: false, safeRoom: false, storage: false, airConditioning: true, garden: false },
  },
];

/** Normalize Yad2 amenity feature flags into a string array */
export function featuresToAmenities(features: Yad2Listing["features"]): string[] {
  const mapping: Record<keyof Yad2Listing["features"], string> = {
    parking: "Parking",
    balcony: "Balcony",
    elevator: "Elevator",
    renovated: "Renovated",
    furnished: "Furnished",
    safeRoom: "Safe Room",
    storage: "Storage",
    airConditioning: "Air Conditioning",
    garden: "Garden",
  };
  return (Object.keys(features) as Array<keyof typeof features>)
    .filter((k) => features[k])
    .map((k) => mapping[k]);
}

/** Convert a Yad2Listing to the format used by our DB insert */
export function yad2ListingToDbInsert(listing: Yad2Listing, userId: string) {
  return {
    user_id: userId,
    address: listing.address,
    city: listing.city,
    price: listing.price,
    rooms: listing.rooms,
    sqm: listing.sqm,
    floor: listing.floor,
    total_floors: listing.totalFloors,
    amenities: featuresToAmenities(listing.features),
    description: listing.description,
    contact_name: listing.contactName,
    contact_phone: listing.contactPhone,
    image_urls: listing.imageUrls,
    source_url: listing.sourceUrl,
  };
}
