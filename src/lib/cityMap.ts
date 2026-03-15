/**
 * Centralized city & amenity mapping for consistent naming across the system.
 *
 * Profiles store slug IDs ("tel-aviv") and English amenity IDs ("parking").
 * Listings from Yad2 scan store Hebrew names ("תל אביב", "חניה").
 * This module bridges the gap so scoring, display, and filtering all work.
 */

// ── City slug ↔ Hebrew mapping ──

export const CITY_SLUG_TO_HE: Record<string, string> = {
  "tel-aviv": "תל אביב",
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
  "jerusalem": "ירושלים",
  "haifa": "חיפה",
  "ashdod": "אשדוד",
  "beer-sheva": "באר שבע",
  "kfar-saba": "כפר סבא",
  "modiin": "מודיעין",
  "ashkelon": "אשקלון",
  "nahariya": "נהריה",
};

export const CITY_HE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_SLUG_TO_HE).map(([slug, he]) => [he, slug])
);

/** Convert a city slug ("tel-aviv") to Hebrew ("תל אביב"), or return as-is if already Hebrew */
export function cityToHebrew(city: string): string {
  return CITY_SLUG_TO_HE[city] ?? city;
}

/** Convert a Hebrew city name to slug, or return as-is if already a slug */
export function cityToSlug(city: string): string {
  return CITY_HE_TO_SLUG[city] ?? city;
}

/** Check if two city values match (handles slug vs Hebrew) */
export function citiesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Normalize both to Hebrew and compare
  const aHe = cityToHebrew(a);
  const bHe = cityToHebrew(b);
  return aHe === bHe;
}

/** Check if a city value is in a list of city values (handles mixed formats) */
export function cityInList(city: string, list: string[]): boolean {
  const cityHe = cityToHebrew(city);
  const citySlug = cityToSlug(city);
  return list.some((c) => c === city || c === cityHe || c === citySlug);
}

// ── Amenity ID ↔ Hebrew mapping ──

export const AMENITY_ID_TO_HE: Record<string, string> = {
  parking: "חניה",
  elevator: "מעלית",
  balcony: "מרפסת",
  pets: "חיות מחמד מותר",
  ac: "מיזוג",
  storage: "מחסן",
  furnished: "מרוהטת",
  accessible: "גישה לנכים",
  safeRoom: 'ממ"ד',
  bars: "סורגים",
  solarHeater: "דוד שמש",
};

export const AMENITY_HE_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(AMENITY_ID_TO_HE).map(([id, he]) => [he, id])
);

// Additional Hebrew amenity variations that map to the same IDs
const AMENITY_HE_ALIASES: Record<string, string> = {
  "חניה תת-קרקעית": "parking",
  "מרפסת שמש": "balcony",
  "דלת פלדלת": "bars",
  "תריסים חשמליים": "ac",
  "גז מרכזי": "ac",
  "ארונות קיר": "storage",
  "משופצת": "furnished",
  "גינה": "balcony",
};

/** Convert an amenity ID ("parking") to Hebrew ("חניה") */
export function amenityToHebrew(id: string): string {
  return AMENITY_ID_TO_HE[id] ?? id;
}

/** Convert a Hebrew amenity name to its ID */
export function amenityToId(he: string): string {
  return AMENITY_HE_TO_ID[he] ?? AMENITY_HE_ALIASES[he] ?? he;
}

/** Check if a listing amenity (Hebrew) matches a profile amenity (ID) */
export function amenityMatches(listingAmenity: string, profileAmenityId: string): boolean {
  if (listingAmenity === profileAmenityId) return true;
  // Convert listing amenity (Hebrew) to ID and compare
  const id = amenityToId(listingAmenity);
  return id === profileAmenityId;
}

/** Count how many profile amenities are satisfied by listing amenities */
export function countAmenityMatches(listingAmenities: string[], profileAmenityIds: string[]): number {
  return profileAmenityIds.filter((profileId) =>
    listingAmenities.some((la) => amenityMatches(la, profileId))
  ).length;
}

// ── Display helpers ──

export const AMENITY_ID_TO_EN: Record<string, string> = {
  parking: "Parking",
  elevator: "Elevator",
  balcony: "Balcony",
  pets: "Pets Allowed",
  ac: "A/C",
  storage: "Storage",
  furnished: "Furnished",
  accessible: "Accessible",
  safeRoom: "Safe Room",
  bars: "Window Bars",
  solarHeater: "Solar Heater",
};

/** Get display name for an amenity ID based on language */
export function amenityDisplayName(id: string, language: string): string {
  if (language === "he") {
    return AMENITY_ID_TO_HE[id] ?? id;
  }
  return AMENITY_ID_TO_EN[id] ?? id;
}

/** Get display name for a city slug based on language */
export function cityDisplayName(slug: string, language: string): string {
  if (language === "he") {
    return CITY_SLUG_TO_HE[slug] ?? slug;
  }
  // For English, capitalize
  const entry = Object.entries(CITY_SLUG_TO_HE).find(([s]) => s === slug);
  if (entry) {
    return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return slug;
}
