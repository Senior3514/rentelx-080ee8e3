import { describe, it, expect } from "vitest";
import { scoreListing } from "@/lib/scoring";

const baseProfile = {
  cities: ["Tel Aviv", "Givatayim"],
  min_price: 5000,
  max_price: 8000,
  min_rooms: 2,
  max_rooms: 3,
  must_haves: ["parking", "elevator"],
  nice_to_haves: ["balcony", "ac"],
};

describe("scoreListing", () => {
  it("returns 100 total for a perfect match", () => {
    const result = scoreListing(
      {
        city: "Tel Aviv",
        price: 6000,
        rooms: 2.5,
        amenities: ["parking", "elevator", "balcony", "ac"],
      },
      baseProfile
    );
    expect(result.city).toBe(100);
    expect(result.price).toBe(100);
    expect(result.rooms).toBe(100);
    expect(result.amenities).toBe(100);
    expect(result.total).toBe(100);
  });

  it("penalises city miss heavily (city weight = 30%)", () => {
    const result = scoreListing(
      {
        city: "Haifa",
        price: 6000,
        rooms: 2.5,
        amenities: ["parking", "elevator"],
      },
      baseProfile
    );
    expect(result.city).toBe(0);
    expect(result.total).toBeLessThan(75);
  });

  it("gives partial price score when price is slightly above range", () => {
    const result = scoreListing(
      { city: "Tel Aviv", price: 8500, rooms: 2, amenities: [] },
      baseProfile
    );
    // price is 500 above max (8000), range = 3000 → dist/range = 500/3000 ≈ 16.7% → score ≈ 83
    expect(result.price).toBeGreaterThan(70);
    expect(result.price).toBeLessThan(100);
  });

  it("gives price score of 0 when price is far above range", () => {
    const result = scoreListing(
      { city: "Tel Aviv", price: 20000, rooms: 2, amenities: [] },
      baseProfile
    );
    expect(result.price).toBe(0);
  });

  it("penalises rooms outside range by 33 per room", () => {
    const result = scoreListing(
      { city: "Tel Aviv", price: 6000, rooms: 1, amenities: [] },
      baseProfile
    );
    // 1 room below min (2) → dist = 1 → score = 100 - 33 = 67
    expect(result.rooms).toBe(67);
  });

  it("returns neutral amenity score (50) when profile has no prefs", () => {
    const profile = { ...baseProfile, must_haves: [], nice_to_haves: [] };
    const result = scoreListing(
      { city: "Tel Aviv", price: 6000, rooms: 2, amenities: [] },
      profile
    );
    expect(result.amenities).toBe(50);
  });

  it("handles missing listing fields gracefully", () => {
    const result = scoreListing({}, baseProfile);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("weighs must_haves double vs nice_to_haves in amenity score", () => {
    const profile = {
      ...baseProfile,
      must_haves: ["parking"],
      nice_to_haves: ["balcony"],
    };
    // Hit must_have only → (1*2 + 0) / (1*2 + 1) = 2/3 ≈ 66
    const resultMust = scoreListing(
      { amenities: ["parking"] },
      profile
    );
    // Hit nice_to_have only → (0*2 + 1) / 3 ≈ 33
    const resultNice = scoreListing(
      { amenities: ["balcony"] },
      profile
    );
    expect(resultMust.amenities).toBeGreaterThan(resultNice.amenities);
  });
});
