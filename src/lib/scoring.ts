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

// Comprehensive neighborhood data for Gush Dan area — proximity scoring
// Each score is 0-100 representing quality/availability in that category
const NEIGHBORHOOD_FEATURES: Record<string, {
  transit: number;      // Public transport quality (buses, trains, light rail)
  shopping: number;     // Supermarkets, grocery stores, malls
  cafes: number;        // Cafes, restaurants, entertainment venues
  quiet: number;        // Residential quiet, green spaces
  supermarkets: number; // Specific supermarket density
  entertainment: number;// Nightlife, culture, cinemas, theaters
}> = {
  // ── Tel Aviv neighborhoods ──
  "פלורנטין":       { transit: 95, shopping: 85, cafes: 95, quiet: 30, supermarkets: 80, entertainment: 95 },
  "נווה צדק":       { transit: 85, shopping: 75, cafes: 90, quiet: 50, supermarkets: 70, entertainment: 85 },
  "רוטשילד":        { transit: 95, shopping: 90, cafes: 95, quiet: 25, supermarkets: 85, entertainment: 95 },
  "לב העיר":        { transit: 95, shopping: 95, cafes: 95, quiet: 20, supermarkets: 90, entertainment: 95 },
  "הצפון הישן":     { transit: 85, shopping: 85, cafes: 80, quiet: 60, supermarkets: 85, entertainment: 75 },
  "הצפון החדש":     { transit: 80, shopping: 80, cafes: 70, quiet: 70, supermarkets: 80, entertainment: 65 },
  "יפו":            { transit: 80, shopping: 75, cafes: 80, quiet: 40, supermarkets: 75, entertainment: 75 },
  "נווה שאנן":      { transit: 90, shopping: 85, cafes: 60, quiet: 35, supermarkets: 80, entertainment: 55 },
  "שפירא":          { transit: 85, shopping: 75, cafes: 70, quiet: 40, supermarkets: 70, entertainment: 65 },
  "כרם התימנים":    { transit: 85, shopping: 80, cafes: 90, quiet: 40, supermarkets: 75, entertainment: 85 },
  "מונטיפיורי":     { transit: 90, shopping: 85, cafes: 85, quiet: 35, supermarkets: 80, entertainment: 80 },
  "בצלאל":          { transit: 80, shopping: 75, cafes: 70, quiet: 55, supermarkets: 70, entertainment: 60 },
  "נחלת בנימין":    { transit: 90, shopping: 85, cafes: 90, quiet: 30, supermarkets: 80, entertainment: 90 },
  "לב יפו":         { transit: 80, shopping: 80, cafes: 85, quiet: 35, supermarkets: 75, entertainment: 80 },
  "עג'מי":          { transit: 70, shopping: 65, cafes: 70, quiet: 50, supermarkets: 60, entertainment: 60 },
  "נוגה":           { transit: 80, shopping: 70, cafes: 85, quiet: 40, supermarkets: 65, entertainment: 80 },
  "כפר שלם":       { transit: 70, shopping: 70, cafes: 45, quiet: 60, supermarkets: 65, entertainment: 40 },
  "התקווה":         { transit: 75, shopping: 70, cafes: 50, quiet: 45, supermarkets: 65, entertainment: 45 },
  "נווה עופר":      { transit: 80, shopping: 75, cafes: 55, quiet: 50, supermarkets: 70, entertainment: 50 },
  "צהלה":           { transit: 65, shopping: 60, cafes: 40, quiet: 85, supermarkets: 55, entertainment: 30 },
  "אפקה":           { transit: 60, shopping: 65, cafes: 45, quiet: 80, supermarkets: 60, entertainment: 35 },
  "רמת אביב":       { transit: 70, shopping: 80, cafes: 70, quiet: 70, supermarkets: 80, entertainment: 60 },
  "רמת אביב ג":     { transit: 65, shopping: 75, cafes: 60, quiet: 75, supermarkets: 75, entertainment: 50 },
  "נווה אביבים":    { transit: 70, shopping: 75, cafes: 55, quiet: 75, supermarkets: 70, entertainment: 45 },
  "בבלי":           { transit: 75, shopping: 80, cafes: 65, quiet: 65, supermarkets: 75, entertainment: 55 },
  "קרית שאול":      { transit: 70, shopping: 70, cafes: 50, quiet: 65, supermarkets: 65, entertainment: 40 },
  "נווה חן":        { transit: 70, shopping: 75, cafes: 65, quiet: 70, supermarkets: 70, entertainment: 55 },

  // ── Givatayim neighborhoods ──
  "גבעתיים":        { transit: 75, shopping: 80, cafes: 70, quiet: 65, supermarkets: 80, entertainment: 60 },
  "בורוכוב":        { transit: 75, shopping: 80, cafes: 75, quiet: 60, supermarkets: 80, entertainment: 65 },
  "גבעת רמב\"ם":    { transit: 70, shopping: 75, cafes: 65, quiet: 70, supermarkets: 75, entertainment: 55 },
  "שינקין":         { transit: 75, shopping: 78, cafes: 70, quiet: 62, supermarkets: 75, entertainment: 60 },

  // ── Ramat Gan neighborhoods ──
  "רמת גן":         { transit: 75, shopping: 80, cafes: 65, quiet: 60, supermarkets: 80, entertainment: 55 },
  "הבורסה":         { transit: 80, shopping: 75, cafes: 60, quiet: 50, supermarkets: 70, entertainment: 50 },
  "נווה יהושע":     { transit: 70, shopping: 70, cafes: 55, quiet: 70, supermarkets: 70, entertainment: 45 },
  "רמת חן":         { transit: 70, shopping: 75, cafes: 55, quiet: 75, supermarkets: 75, entertainment: 45 },
  "רמת עמידר":      { transit: 70, shopping: 70, cafes: 50, quiet: 65, supermarkets: 70, entertainment: 40 },
  "הגפן":           { transit: 65, shopping: 70, cafes: 50, quiet: 70, supermarkets: 70, entertainment: 40 },
  "קריית קריניצי":  { transit: 75, shopping: 80, cafes: 60, quiet: 55, supermarkets: 80, entertainment: 50 },

  // ── Holon neighborhoods ──
  "חולון":           { transit: 65, shopping: 75, cafes: 55, quiet: 70, supermarkets: 75, entertainment: 45 },
  "נווה ארזים":     { transit: 60, shopping: 70, cafes: 50, quiet: 75, supermarkets: 70, entertainment: 40 },
  "קרית שרת":       { transit: 60, shopping: 70, cafes: 45, quiet: 70, supermarkets: 70, entertainment: 35 },
  "ג'סי כהן":       { transit: 65, shopping: 70, cafes: 45, quiet: 60, supermarkets: 65, entertainment: 35 },

  // ── Bat Yam neighborhoods ──
  "בת ים":           { transit: 65, shopping: 70, cafes: 50, quiet: 65, supermarkets: 70, entertainment: 40 },
  "חוף הים":        { transit: 60, shopping: 65, cafes: 55, quiet: 55, supermarkets: 60, entertainment: 50 },

  // ── Bnei Brak neighborhoods ──
  "בני ברק":         { transit: 75, shopping: 75, cafes: 40, quiet: 50, supermarkets: 75, entertainment: 30 },
  "פרדס כץ":        { transit: 70, shopping: 75, cafes: 45, quiet: 55, supermarkets: 75, entertainment: 35 },

  // ── Petah Tikva neighborhoods ──
  "פתח תקווה":      { transit: 60, shopping: 75, cafes: 50, quiet: 70, supermarkets: 75, entertainment: 40 },
  "כפר אברהם":     { transit: 55, shopping: 70, cafes: 45, quiet: 75, supermarkets: 70, entertainment: 35 },
  "עין גנים":       { transit: 55, shopping: 65, cafes: 40, quiet: 80, supermarkets: 65, entertainment: 30 },
  "כפר גנים":       { transit: 60, shopping: 75, cafes: 50, quiet: 70, supermarkets: 75, entertainment: 40 },

  // ── Herzliya neighborhoods ──
  "הרצליה":          { transit: 60, shopping: 80, cafes: 70, quiet: 75, supermarkets: 80, entertainment: 60 },
  "הרצליה פיתוח":   { transit: 55, shopping: 70, cafes: 75, quiet: 80, supermarkets: 65, entertainment: 65 },

  // ── Rishon LeZion neighborhoods ──
  "ראשון לציון":     { transit: 60, shopping: 80, cafes: 55, quiet: 70, supermarkets: 80, entertainment: 45 },
  "נחלת יהודה":     { transit: 55, shopping: 70, cafes: 45, quiet: 75, supermarkets: 65, entertainment: 35 },

  // ── Netanya neighborhoods ──
  "נתניה":           { transit: 55, shopping: 75, cafes: 55, quiet: 70, supermarkets: 75, entertainment: 45 },

  // ── Ra'anana neighborhoods ──
  "רעננה":           { transit: 55, shopping: 80, cafes: 65, quiet: 80, supermarkets: 80, entertainment: 50 },

  // ── Rehovot neighborhoods ──
  "רחובות":          { transit: 55, shopping: 75, cafes: 50, quiet: 75, supermarkets: 75, entertainment: 40 },
};

// City-level features as fallback when neighborhood is unknown
const CITY_FEATURES: Record<string, { transit: number; shopping: number; cafes: number; quiet: number; supermarkets: number; entertainment: number }> = {
  "תל אביב":       { transit: 90, shopping: 85, cafes: 90, quiet: 35, supermarkets: 85, entertainment: 90 },
  "גבעתיים":        { transit: 75, shopping: 80, cafes: 70, quiet: 65, supermarkets: 80, entertainment: 60 },
  "רמת גן":         { transit: 75, shopping: 80, cafes: 65, quiet: 60, supermarkets: 80, entertainment: 55 },
  "חולון":           { transit: 65, shopping: 75, cafes: 55, quiet: 70, supermarkets: 75, entertainment: 45 },
  "בת ים":           { transit: 65, shopping: 70, cafes: 50, quiet: 65, supermarkets: 70, entertainment: 40 },
  "בני ברק":         { transit: 75, shopping: 75, cafes: 40, quiet: 50, supermarkets: 75, entertainment: 30 },
  "פתח תקווה":      { transit: 60, shopping: 75, cafes: 50, quiet: 70, supermarkets: 75, entertainment: 40 },
  "הרצליה":          { transit: 60, shopping: 80, cafes: 70, quiet: 75, supermarkets: 80, entertainment: 60 },
  "ראשון לציון":     { transit: 60, shopping: 80, cafes: 55, quiet: 70, supermarkets: 80, entertainment: 45 },
  "נתניה":           { transit: 55, shopping: 75, cafes: 55, quiet: 70, supermarkets: 75, entertainment: 45 },
  "רעננה":           { transit: 55, shopping: 80, cafes: 65, quiet: 80, supermarkets: 80, entertainment: 50 },
  "רחובות":          { transit: 55, shopping: 75, cafes: 50, quiet: 75, supermarkets: 75, entertainment: 40 },
};

// Rough commute distance estimates between major areas (in minutes by car/transit)
// Used when workplace_address is set — we estimate commute quality
const COMMUTE_MATRIX: Record<string, Record<string, number>> = {
  "תל אביב": { "תל אביב": 10, "גבעתיים": 12, "רמת גן": 15, "חולון": 20, "בת ים": 20, "בני ברק": 15, "פתח תקווה": 30, "הרצליה": 20, "ראשון לציון": 25, "נתניה": 45, "רעננה": 30, "רחובות": 35 },
  "גבעתיים": { "תל אביב": 12, "גבעתיים": 5, "רמת גן": 8, "חולון": 18, "בת ים": 20, "בני ברק": 10, "פתח תקווה": 25, "הרצליה": 25, "ראשון לציון": 25, "נתניה": 45, "רעננה": 35, "רחובות": 35 },
  "רמת גן":  { "תל אביב": 15, "גבעתיים": 8, "רמת גן": 5, "חולון": 20, "בת ים": 22, "בני ברק": 8, "פתח תקווה": 20, "הרצליה": 25, "ראשון לציון": 25, "נתניה": 45, "רעננה": 35, "רחובות": 35 },
  "חולון":    { "תל אביב": 20, "גבעתיים": 18, "רמת גן": 20, "חולון": 5, "בת ים": 10, "בני ברק": 20, "פתח תקווה": 30, "הרצליה": 30, "ראשון לציון": 15, "נתניה": 50, "רעננה": 40, "רחובות": 25 },
  "בת ים":    { "תל אביב": 20, "גבעתיים": 20, "רמת גן": 22, "חולון": 10, "בת ים": 5, "בני ברק": 25, "פתח תקווה": 35, "הרצליה": 35, "ראשון לציון": 15, "נתניה": 55, "רעננה": 45, "רחובות": 25 },
  "בני ברק":  { "תל אביב": 15, "גבעתיים": 10, "רמת גן": 8, "חולון": 20, "בת ים": 25, "בני ברק": 5, "פתח תקווה": 15, "הרצליה": 25, "ראשון לציון": 30, "נתניה": 40, "רעננה": 30, "רחובות": 35 },
  "פתח תקווה": { "תל אביב": 30, "גבעתיים": 25, "רמת גן": 20, "חולון": 30, "בת ים": 35, "בני ברק": 15, "פתח תקווה": 5, "הרצליה": 30, "ראשון לציון": 35, "נתניה": 40, "רעננה": 25, "רחובות": 35 },
  "הרצליה":   { "תל אביב": 20, "גבעתיים": 25, "רמת גן": 25, "חולון": 30, "בת ים": 35, "בני ברק": 25, "פתח תקווה": 30, "הרצליה": 5, "ראשון לציון": 35, "נתניה": 25, "רעננה": 10, "רחובות": 40 },
  "ראשון לציון": { "תל אביב": 25, "גבעתיים": 25, "רמת גן": 25, "חולון": 15, "בת ים": 15, "בני ברק": 30, "פתח תקווה": 35, "הרצליה": 35, "ראשון לציון": 5, "נתניה": 55, "רעננה": 45, "רחובות": 15 },
  "נתניה":    { "תל אביב": 45, "גבעתיים": 45, "רמת גן": 45, "חולון": 50, "בת ים": 55, "בני ברק": 40, "פתח תקווה": 40, "הרצליה": 25, "ראשון לציון": 55, "נתניה": 5, "רעננה": 15, "רחובות": 55 },
  "רעננה":    { "תל אביב": 30, "גבעתיים": 35, "רמת גן": 35, "חולון": 40, "בת ים": 45, "בני ברק": 30, "פתח תקווה": 25, "הרצליה": 10, "ראשון לציון": 45, "נתניה": 15, "רעננה": 5, "רחובות": 50 },
  "רחובות":   { "תל אביב": 35, "גבעתיים": 35, "רמת גן": 35, "חולון": 25, "בת ים": 25, "בני ברק": 35, "פתח תקווה": 35, "הרצליה": 40, "ראשון לציון": 15, "נתניה": 55, "רעננה": 50, "רחובות": 5 },
};

/** Extract city name from an address string (best-effort) */
function extractCityFromAddress(address: string): string | null {
  const cities = Object.keys(COMMUTE_MATRIX);
  const normalized = address.trim();
  for (const city of cities) {
    if (normalized.includes(city)) return city;
  }
  return null;
}

/** Estimate commute score based on workplace and listing city (0-100) */
function getCommuteScore(listingCity: string | null, workplaceAddress: string): number {
  if (!listingCity) return 50;

  const workCity = extractCityFromAddress(workplaceAddress);
  if (!workCity) return 50; // Can't determine workplace city

  const cityNorm = listingCity.trim();
  const matrix = COMMUTE_MATRIX[cityNorm];
  if (!matrix) return 50;

  const minutes = matrix[workCity];
  if (minutes == null) return 50;

  // Convert commute minutes to score: <10min=100, 15min=90, 30min=70, 45min=50, 60min=30
  if (minutes <= 10) return 100;
  if (minutes <= 15) return 90;
  if (minutes <= 20) return 80;
  if (minutes <= 30) return 70;
  if (minutes <= 45) return 50;
  return Math.max(20, 100 - minutes * 1.5);
}

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
  // transit 30%, supermarkets 15%, cafes 15%, entertainment 10%, shopping 10%, quiet 20%
  let score =
    features.transit * 0.30 +
    (features.supermarkets ?? features.shopping) * 0.15 +
    features.cafes * 0.15 +
    (features.entertainment ?? features.cafes) * 0.10 +
    features.shopping * 0.10 +
    features.quiet * 0.20;

  // Boost if desired area matches
  if (profile.desired_area && (neighborhood || city)) {
    const desired = profile.desired_area.toLowerCase();
    const loc = `${neighborhood || ""} ${city || ""}`.toLowerCase();
    if (loc.includes(desired) || desired.includes(loc.trim())) {
      score = Math.min(100, score + 15);
    }
  }

  // Commute bonus/penalty if workplace is set
  if (profile.workplace_address && city) {
    const commuteScore = getCommuteScore(city, profile.workplace_address);
    // Blend commute into location score (30% weight)
    score = score * 0.7 + commuteScore * 0.3;
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

  // Location quality score (transit, shops, cafes, commute, etc.)
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
