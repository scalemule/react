import { describe, it, expect, vi } from "vitest";
import type { CommunityMapFeature } from "@scalemule/sdk";
import {
  atlasStreetKey,
  communityStreetActivity,
  communityStreetGeoJSON,
  type CommunityAtlasGeography,
} from "./atlas-data";
import { loadCommunityAtlasFeatures } from "./atlas";
import type { CommunityMapsClient } from "./client";
const geography = {
  streets: {
    type: "FeatureCollection",
    features: [0, 1].map((id) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-122, 37.9],
          [-122.001, 37.91],
        ],
      },
      properties: {
        id: String(id),
        name: "Arbolado Drive",
        class: "residential",
      },
    })),
  },
} as CommunityAtlasGeography;
function place(id: string, label: string, area = "walnut-creek") {
  return {
    id,
    area_id: area,
    content: {
      location_label: label,
      residential: true,
      metadata: {},
      geometry: { type: "Point", coordinates: [-122.00015, 37.90009] },
    },
    reactions: { pumpkin: 900 },
  } as unknown as CommunityMapFeature;
}
describe("city street aggregation", () => {
  it("counts canonical public places once across road segments and contributions", () => {
    const first = place("first", "Arbolado Dr., Walnut Creek");
    const streets = communityStreetActivity(geography, [
      first,
      first,
      place("second", "Arbolado Drive"),
    ]);
    expect(streets).toHaveLength(1);
    expect(streets[0].count).toBe(2);
    const geo = communityStreetGeoJSON(geography, streets);
    expect(geo.features).toHaveLength(2);
    expect(geo.features[0].properties.count).toBe(2);
    // Highlight reference street geometry, never the submitted/approved point.
    expect(geo.features[0].geometry).toEqual(
      geography.streets.features[0].geometry,
    );
    expect(JSON.stringify(geo)).not.toContain("37.90009");
    expect(JSON.stringify(geo)).not.toContain("pumpkin");
  });
  it("does not infer a street from a house address, intersection or an unknown place", () => {
    expect(
      communityStreetActivity(geography, [
        place("1", "1234 Arbolado Drive"),
        place("2", "Arbolado Drive & Other Road"),
        place("3", "An unverified street"),
      ]),
    ).toEqual([]);
    expect(atlasStreetKey("１２３４ Arbolado Drive")).toBeNull();
  });
  it("preserves international Unicode street labels", () => {
    expect(atlasStreetKey("Улица Шипка, София")).toBe("улица шипка");
    expect(atlasStreetKey("桜通り 🌸")).toBe("桜通り 🌸");
    expect(atlasStreetKey("42nd Street")).toBe("42nd street");
  });
});
describe("complete city activity loading", () => {
  it("fetches all pages, deduplicates IDs and retains only the requested community", async () => {
    const features = vi
      .fn()
      .mockResolvedValueOnce({
        items: [place("1", "Arbolado Drive")],
        next_cursor: "second",
      })
      .mockResolvedValueOnce({
        items: [
          place("1", "Arbolado Drive"),
          place("2", "Arbolado Drive"),
          place("other-city", "Arbolado Drive", "other"),
        ],
        next_cursor: null,
      });
    const client = { features } as unknown as CommunityMapsClient;
    const signal = new AbortController().signal;
    const result = await loadCommunityAtlasFeatures(
      client,
      "halloween-2026",
      "walnut-creek",
      signal,
    );
    expect(result.map((f) => f.id)).toEqual(["1", "2"]);
    expect(features).toHaveBeenLastCalledWith(
      "halloween-2026",
      { area_id: "walnut-creek", limit: 200, after: "second" },
      signal,
    );
  });
  it("reports a broken repeated cursor rather than looping or reporting partial counts", async () => {
    const client = {
      features: vi.fn().mockResolvedValue({ items: [], next_cursor: "repeat" }),
    } as unknown as CommunityMapsClient;
    await expect(
      loadCommunityAtlasFeatures(
        client,
        "guide",
        "walnut-creek",
        new AbortController().signal,
      ),
    ).rejects.toThrow("finish loading");
  });
});
