interface ScoringListing {
  city?: string | null;
  price?: number | null;
  rooms?: number | null;
  amenities?: string[];
  neighborhood?: string | null;
  address?: string | null;
}

interface ScoringProfile {
  cities: string[];
  min_price: number;
  max_price: number;
  min_rooms: number;
  max_rooms: number;
  must_haves: string[];
  nice_to_haves: string[];
  workplace_address?: string | null;
  current_address?: string | null;
  desired_area?: string | null;
}

export interface ScoreBreakdown {
  city: number;
  price: number;
  rooms: number;
  amenities: number;
  location: number;
  total: number;
}

const WEIGHTS = { city: 25, price: 25, rooms: 15, amenities: 15, location: 20 };

// Known neighborhood data for Gush Dan area — proximity scoring
const NEIGHBORHOOD_FEATURES: Record<string, {
  transit: number;   // 0-100 public transport score
  shopping: number;  // 0-100 supermarkets/malls
  cafes: number;     // 0-100 cafes/entertainment
  quiet: number;     // 0-100 quiet residential
}> = {
  // Tel Aviv neighborhoods
  "פלורנטין": { transit: 95, shopping: 85, cafes: 95, quiet: 30 },
  "נווה צדק": { transit: 85, shopping: 75, cafes: 90, quiet: 50 },
  "רוטשילד": { transit: 95, shopping: 90, cafes: 95, quiet: 25 },
  "לב העיר": { transit: 95, shopping: 95, cafes: 95, quiet: 20 },
  "הצפון הישן": { transit: 85, shopping: 85, cafes: 80, quiet: 60 },
  "הצפון החדש": { transit: 80, shopping: 80, cafes: 70, quiet: 70 },
  "יפו": { transit: 80, shopping: 75, cafes: 80, quiet: 40 },
  "נווה שאנן": { transit: 90, shopping: 85, cafes: 60, quiet: 35 },
  "שפירא": { transit: 85, shopping: 75, cafes: 70, quiet: 40 },
  "כרם התימנים": { transit: 85, shopping: 80, cafes: 90, quiet: 40 },
  "מונטיפיורי": { transit: 90, shopping: 85, cafes: 85, quiet: 35 },
  "בצלאל": { transit: 80, shopping: 75, cafes: 70, quiet: 55 },
  // Givatayim
  "גבעתיים": { transit: 75, shopping: 80, cafes: 70, quiet: 65 },
  "בורוכוב": { transit: 75, shopping: 80, cafes: 75, quiet: 60 },
  // Ramat Gan
  "רמת גן": { transit: 75, shopping: 80, cafes: 65, quiet: 60 },
  "הבורסה": { transit: 80, shopping: 75, cafes: 60, quiet: 50 },
  "נווה יהושע": { transit: 70, shopping: 70, cafes: 55, quiet: 70 },
  // Holon
  "חולון": { transit: 65, shopping: 75, cafes: 55, quiet: 70 },
  // Bat Yam
  "בת ים": { transit: 65, shopping: 70, cafes: 50, quiet: 65 },
  // Bnei Brak
  "בני ברק": { transit: 75, shopping: 75, cafes: 40, quiet: 50 },
  // Petah Tikva
  "פתח תקווה": { transit: 60, shopping: 75, cafes: 50, quiet: 70 },
  // Herzliya
  "הרצליה": { transit: 60, shopping: 80, cafes: 70, quiet: 75 },
  "הרצליה פיתוח": { transit: 55, shopping: 70, cafes: 75, quiet: 80 },
  // Rishon LeZion
  "ראשון לציון": { transit: 60, shopping: 80, cafes: 55, quiet: 70 },
};

// City-level features as fallback
const CITY_FEATURES: Record<string, { transit: number; shopping: number; cafes: number; quiet: number }> = {
  "תל אביב": { transit: 90, shopping: 85, cafes: 90, quiet: 35 },
  "גבעתיים": { transit: 75, shopping: 80, cafes: 70, quiet: 65 },
  "רמת גן": { transit: 75, shopping: 80, cafes: 65, quiet: 60 },
  "חולון": { transit: 65, shopping: 75, cafes: 55, quiet: 70 },
  "בת ים": { transit: 65, shopping: 70, cafes: 50, quiet: 65 },
  "בני ברק": { transit: 75, shopping: 75, cafes: 40, quiet: 50 },
  "פתח תקווה": { transit: 60, shopping: 75, cafes: 50, quiet: 70 },
  "הרצליה": { transit: 60, shopping: 80, cafes: 70, quiet: 75 },
  "ראשון לציון": { transit: 60, shopping: 80, cafes: 55, quiet: 70 },
};

function getLocationScore(listing: ScoringListing, profile: ScoringProfile): number {
  // Try neighborhood first, then city
  const neighborhood = listing.neighborhood?.trim();
  const city = listing.city?.trim();

  let features = neighborhood ? NEIGHBORHOOD_FEATURES[neighborhood] : null;
  if (!features && city) {
    features = CITY_FEATURES[city] || null;
  }

  if (!features) return 50; // neutral if unknown

  // Composite location quality score
  // Weight: transit 35%, shopping 25%, cafes 20%, quiet 20%
  let score = features.transit * 0.35 + features.shopping * 0.25 + features.cafes * 0.20 + features.quiet * 0.20;

  // Boost if desired area matches
  if (profile.desired_area && (neighborhood || city)) {
    const desired = profile.desired_area.toLowerCase();
    const loc = `${neighborhood || ""} ${city || ""}`.toLowerCase();
    if (loc.includes(desired) || desired.includes(loc.trim())) {
      score = Math.min(100, score + 15);
    }
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function scoreListing(listing: ScoringListing, profile: ScoringProfile): ScoreBreakdown {
  // City match (0 or 100)
  const cityScore = listing.city && profile.cities.includes(listing.city) ? 100 : 0;

  // Price match
  let priceScore = 0;
  if (listing.price != null) {
    if (listing.price >= profile.min_price && listing.price <= profile.max_price) {
      priceScore = 100;
    } else {
      const range = profile.max_price - profile.min_price;
      const dist = listing.price < profile.min_price
        ? profile.min_price - listing.price
        : listing.price - profile.max_price;
      priceScore = Math.max(0, 100 - (dist / (range || 1)) * 100);
    }
  }

  // Room match
  let roomsScore = 0;
  if (listing.rooms != null) {
    if (listing.rooms >= profile.min_rooms && listing.rooms <= profile.max_rooms) {
      roomsScore = 100;
    } else {
      const dist = listing.rooms < profile.min_rooms
        ? profile.min_rooms - listing.rooms
        : listing.rooms - profile.max_rooms;
      roomsScore = Math.max(0, 100 - dist * 33);
    }
  }

  // Amenity match
  let amenitiesScore = 0;
  const allWanted = [...profile.must_haves, ...profile.nice_to_haves];
  if (allWanted.length > 0 && listing.amenities) {
    const mustHits = profile.must_haves.filter((a) => listing.amenities!.includes(a)).length;
    const niceHits = profile.nice_to_haves.filter((a) => listing.amenities!.includes(a)).length;
    const mustWeight = profile.must_haves.length * 2;
    const niceWeight = profile.nice_to_haves.length;
    const totalWeight = mustWeight + niceWeight || 1;
    amenitiesScore = ((mustHits * 2 + niceHits) / totalWeight) * 100;
  } else {
    amenitiesScore = 50; // neutral if no prefs
  }

  // Location quality score (transit, shops, cafes, etc.)
  const locationScore = getLocationScore(listing, profile);

  const total = Math.round(
    (cityScore * WEIGHTS.city +
      priceScore * WEIGHTS.price +
      roomsScore * WEIGHTS.rooms +
      amenitiesScore * WEIGHTS.amenities +
      locationScore * WEIGHTS.location) /
      100
  );

  return {
    city: Math.round(cityScore),
    price: Math.round(priceScore),
    rooms: Math.round(roomsScore),
    amenities: Math.round(amenitiesScore),
    location: Math.round(locationScore),
    total,
  };
}
