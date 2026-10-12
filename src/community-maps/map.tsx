"use client";
import { useEffect, useRef, useState } from "react";
import type {
  CommunityMapFeature,
  CommunityMapGeometry,
  CommunityMapArea,
} from "@scalemule/sdk";
import type { GeoJSONSource } from "maplibre-gl";
export type CommunityMapBounds = [number, number, number, number];
export interface CommunityMapInstance {
  update(features: CommunityMapFeature[]): void;
  destroy(): void;
}
export interface CommunityMapProvider {
  mount(
    container: HTMLElement,
    options: {
      styleUrl: string;
      features: CommunityMapFeature[];
      areas: CommunityMapArea[];
      accent: string;
      onSelect: (id: string) => void;
      onBounds: (bounds: CommunityMapBounds) => void;
      onError: () => void;
    },
  ): Promise<CommunityMapInstance>;
}
export function geometryPositions(
  geometry: CommunityMapGeometry,
): [number, number][] {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "LineString":
      return geometry.coordinates;
    case "Polygon":
      return geometry.coordinates.flat();
  }
}
/** GeoJSON stays independent of this optional rendering adapter. No default tile service. */
export const mapLibreCommunityProvider: CommunityMapProvider = {
  async mount(container, options) {
    const lib = await import("maplibre-gl");
    lib.setWorkerUrl(
      `/_scalemule/community-maps/maplibre-gl-worker-${lib.getVersion()}.mjs`,
    );
    const initialPoints = (
      options.features.length
        ? options.features.map((f) => f.content.geometry)
        : options.areas.flatMap((a) => (a.geometry ? [a.geometry] : []))
    ).flatMap(geometryPositions);
    const initialBounds = initialPoints.length
      ? new lib.LngLatBounds(initialPoints[0], initialPoints[0])
      : undefined;
    initialPoints.forEach((point) => initialBounds?.extend(point));
    const map = new lib.Map({
      container,
      style: options.styleUrl,
      ...(initialBounds
        ? {
            bounds: initialBounds,
            fitBoundsOptions: { padding: 48, maxZoom: 14 },
          }
        : { center: [0, 20] as [number, number], zoom: 1 }),
      attributionControl: { compact: false },
    });
    map.addControl(new lib.NavigationControl(), "top-right");
    let features = options.features;
    let fitted = false;
    function collection() {
      return {
        type: "FeatureCollection" as const,
        features: features.map((f) => ({
          type: "Feature" as const,
          id: f.id,
          geometry: f.content.geometry,
          properties: {
            id: f.id,
            title: f.content.title,
            featured: f.featured,
          },
        })),
      };
    }
    function fit() {
      if (fitted) return;
      const points = (
        features.length
          ? features.map((f) => f.content.geometry)
          : options.areas.flatMap((a) => (a.geometry ? [a.geometry] : []))
      ).flatMap(geometryPositions);
      if (!points.length) return;
      const bounds = new lib.LngLatBounds(points[0], points[0]);
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
      fitted = true;
    }
    map.on("load", () => {
      map.addSource("community-features", {
        type: "geojson",
        data: collection(),
      });
      map.addLayer({
        id: "community-areas",
        source: "community-features",
        type: "fill",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": options.accent, "fill-opacity": 0.2 },
      });
      map.addLayer({
        id: "community-streets",
        source: "community-features",
        type: "line",
        filter: [
          "in",
          ["geometry-type"],
          ["literal", ["LineString", "Polygon"]],
        ],
        paint: {
          "line-color": options.accent,
          "line-width": ["case", ["get", "featured"], 6, 3],
        },
      });
      map.addLayer({
        id: "community-points",
        source: "community-features",
        type: "circle",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": options.accent,
          "circle-radius": ["case", ["get", "featured"], 10, 7],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      for (const layer of [
        "community-points",
        "community-streets",
        "community-areas",
      ]) {
        map.on("click", layer, (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") options.onSelect(id);
        });
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      fit();
    });
    map.on("error", options.onError);
    map.on("moveend", () => {
      const b = map.getBounds();
      const west = Math.max(-180, b.getWest()),
        east = Math.min(180, b.getEast());
      if (west < east)
        options.onBounds([
          west,
          Math.max(-90, b.getSouth()),
          east,
          Math.min(90, b.getNorth()),
        ]);
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container);
    return {
      update(next) {
        features = next;
        const source = map.getSource("community-features") as
          GeoJSONSource | undefined;
        source?.setData(collection());
        if (map.loaded()) fit();
      },
      destroy() {
        resize.disconnect();
        map.remove();
      },
    };
  },
};
export interface CommunityMapProps {
  features: CommunityMapFeature[];
  areas?: CommunityMapArea[];
  styleUrl?: string | null;
  accent?: string;
  provider?: CommunityMapProvider;
  onSelect?: (id: string) => void;
  onBounds?: (bounds: CommunityMapBounds) => void;
  label?: string;
}
export function CommunityMap({
  features,
  areas = [],
  styleUrl,
  accent = "#a64916",
  provider = mapLibreCommunityProvider,
  onSelect,
  onBounds,
  label = "Community places map",
}: CommunityMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<CommunityMapInstance>();
  const latest = useRef({ features, areas, onSelect, onBounds });
  latest.current = { features, areas, onSelect, onBounds };
  const [error, setError] = useState(false);
  const areaKey = areas.map((a) => a.id).join(",");
  useEffect(() => {
    if (!container.current || !styleUrl) return;
    let disposed = false;
    setError(false);
    provider
      .mount(container.current, {
        styleUrl,
        features: latest.current.features,
        areas: latest.current.areas,
        accent,
        onSelect: (id) => latest.current.onSelect?.(id),
        onBounds: (b) => latest.current.onBounds?.(b),
        onError: () => setError(true),
      })
      .then((map) => {
        if (disposed) map.destroy();
        else {
          instance.current = map;
          map.update(latest.current.features);
        }
      })
      .catch(() => setError(true));
    return () => {
      disposed = true;
      instance.current?.destroy();
      instance.current = undefined;
    };
  }, [styleUrl, accent, provider, areaKey]);
  useEffect(() => {
    instance.current?.update(features);
  }, [features]);
  return (
    <section className="smcm-map" aria-label={label}>
      <div ref={container} className="smcm-map-canvas" aria-label={label} />
      {(!styleUrl || error) && (
        <p className="smcm-map-message" role="status">
          Map view is unavailable. Browse the places below.
        </p>
      )}
      <p className="smcm-map-key">
        <span>● Places</span>
        <span>━ Streets & routes</span>
        <span>▧ Neighborhoods</span>
      </p>
    </section>
  );
}
