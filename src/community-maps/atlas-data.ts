import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
} from "geojson";
import type { CommunityMapFeature } from "@scalemule/sdk";

export type AtlasLandmarkKind =
  "park" | "oak" | "owl" | "ranch" | "garden" | "town" | "train" | "hills";
export interface CommunityAtlasLandmark {
  id: string;
  name: string;
  coordinates: [number, number];
  kind: AtlasLandmarkKind;
  description: string;
  minZoom?: number;
  url: string;
}
export interface CommunityAtlasGeography {
  name: string;
  areaSlug: string;
  bounds: [number, number, number, number];
  boundary: FeatureCollection<Polygon | MultiPolygon>;
  outsideMask?: FeatureCollection<Polygon | MultiPolygon>;
  streets: FeatureCollection<
    LineString | MultiLineString,
    { id: string; name: string; class: string }
  >;
  land: FeatureCollection;
  water: FeatureCollection;
  landmarks: CommunityAtlasLandmark[];
  sources: {
    title: string;
    url: string;
    attribution: string;
    retrieved: string;
  }[];
}
export interface CommunityStreetActivity {
  key: string;
  name: string;
  count: number;
  features: CommunityMapFeature[];
}
export const STREET_ACTIVITY_SCALE = [
  { minimum: 1, label: "1 place", color: "#edbb55" },
  { minimum: 2, label: "2–4", color: "#e58b32" },
  { minimum: 5, label: "5–9", color: "#cf5436" },
  { minimum: 10, label: "10+", color: "#852e4c" },
] as const;

/** Only approved public street labels are matched. House addresses are never labels. */
export function atlasStreetKey(label: string): string | null {
  const street = label.split(",")[0].normalize("NFKC").trim();
  if (
    !street ||
    /^\p{N}+(?:[-/]\p{N}+)?\s/u.test(street) ||
    /[&#/]/u.test(street)
  )
    return null;
  const words: Record<string, string> = {
    st: "street",
    rd: "road",
    dr: "drive",
    ave: "avenue",
    blvd: "boulevard",
    ct: "court",
    ln: "lane",
    pkwy: "parkway",
    n: "north",
    s: "south",
    e: "east",
    w: "west",
  };
  return street
    .toLocaleLowerCase("en-US")
    .replace(/\./g, "")
    .split(/\s+/u)
    .map((word) => words[word] || word)
    .join(" ");
}

/** Counts canonical published features, not submissions, votes or duplicate contributions. */
export function communityStreetActivity(
  geography: CommunityAtlasGeography,
  features: CommunityMapFeature[],
) {
  const streets = new Map<string, CommunityStreetActivity>();
  for (const road of geography.streets.features) {
    const key = atlasStreetKey(road.properties.name);
    if (key && !streets.has(key))
      streets.set(key, {
        key,
        name: road.properties.name,
        count: 0,
        features: [],
      });
  }
  const seen = new Set<string>();
  for (const feature of features) {
    if (seen.has(feature.id)) continue;
    seen.add(feature.id);
    const explicit = feature.content.metadata?.street_name;
    const key = atlasStreetKey(
      typeof explicit === "string" ? explicit : feature.content.location_label,
    );
    const street = key ? streets.get(key) : undefined;
    if (!street) continue;
    street.features.push(feature);
    street.count += 1;
  }
  return [...streets.values()]
    .filter((street) => street.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function communityStreetGeoJSON(
  geography: CommunityAtlasGeography,
  activity: CommunityStreetActivity[],
) {
  const counts = new Map(activity.map((street) => [street.key, street.count]));
  return {
    type: "FeatureCollection" as const,
    features: geography.streets.features.flatMap((street) => {
      const key = atlasStreetKey(street.properties.name);
      const count = key ? counts.get(key) : undefined;
      return count
        ? [
            {
              ...street,
              properties: { key, name: street.properties.name, count },
            },
          ]
        : [];
    }),
  };
}
