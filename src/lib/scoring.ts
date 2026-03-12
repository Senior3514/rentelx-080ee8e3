interface ScoringListing {
  city?: string | null;
  price?: number | null;
  rooms?: number | null;
  amenities?: string[];
}

interface ScoringProfile {
  cities: string[];
  min_price: number;
  max_price: number;
  min_rooms: number;
  max_rooms: number;
  must_haves: string[];
  nice_to_haves: string[];
}

export interface ScoreBreakdown {
  city: number;
  price: number;
  rooms: number;
  amenities: number;
  total: number;
}

const WEIGHTS = { city: 30, price: 30, rooms: 20, amenities: 20 };

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

  const total = Math.round(
    (cityScore * WEIGHTS.city +
      priceScore * WEIGHTS.price +
      roomsScore * WEIGHTS.rooms +
      amenitiesScore * WEIGHTS.amenities) /
      100
  );

  return {
    city: Math.round(cityScore),
    price: Math.round(priceScore),
    rooms: Math.round(roomsScore),
    amenities: Math.round(amenitiesScore),
    total,
  };
}
