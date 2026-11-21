"use client";
import { CommunityVote } from "./engagement";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CommunityMapCollection,
  CommunityMapFeature,
} from "@scalemule/sdk";
import type {
  GeoJSONSource,
  Map as LibreMap,
  ExpressionSpecification,
} from "maplibre-gl";
import type { CommunityMapsClient } from "./client";
import { illustratedStyle } from "./atlas-style";
import { atlasLandmarkSvg } from "./atlas-art";
import {
  communityStreetActivity,
  communityStreetGeoJSON,
  STREET_ACTIVITY_SCALE,
  type CommunityAtlasGeography,
  type CommunityAtlasLandmark,
  type CommunityStreetActivity,
} from "./atlas-data";

/** A named neighborhood inside the atlas community, shown as a label the reader can jump to. */
export interface CommunityAtlasPlace {
  id: string;
  name: string;
  /** [longitude, latitude] */
  coordinates: [number, number];
  /** Camera zoom when the map centres on this place (default 15). */
  zoom?: number;
}
export interface CommunityCityAtlasConfig {
  geographyUrl: string;
  areaSlug: string;
  /** TileJSON URL for a vector source using the OpenMapTiles schema. */
  contextTilesUrl?: string;
  /** Neighborhoods inside this community, in display order. */
  places?: CommunityAtlasPlace[];
  /** Place id the map opens centred on; unknown ids open on the whole community. */
  focusPlace?: string;
}
export type CommunityAtlasView =
  | { kind: "bounds" }
  | { kind: "place"; id: string; center: [number, number]; zoom: number };
const DEFAULT_PLACE_ZOOM = 15;
function validPlace(place: CommunityAtlasPlace | undefined) {
  return Boolean(
    place &&
    Array.isArray(place.coordinates) &&
    place.coordinates.length === 2 &&
    place.coordinates.every((v) => Number.isFinite(v)) &&
    Math.abs(place.coordinates[0]) <= 180 &&
    Math.abs(place.coordinates[1]) <= 90,
  );
}
/** The camera a map opens with: centred on a known, valid place, otherwise the whole community. */
export function communityAtlasView(
  places: readonly CommunityAtlasPlace[] | undefined,
  focusPlace: string | undefined,
): CommunityAtlasView {
  const place = focusPlace
    ? places?.find((p) => p.id === focusPlace)
    : undefined;
  if (!place || !validPlace(place)) return { kind: "bounds" };
  const zoom =
    typeof place.zoom === "number" && Number.isFinite(place.zoom)
      ? Math.min(18, Math.max(0, place.zoom))
      : DEFAULT_PLACE_ZOOM;
  return { kind: "place", id: place.id, center: place.coordinates, zoom };
}
/** Places with usable coordinates, in their given order. */
export function communityAtlasPlaces(
  places: readonly CommunityAtlasPlace[] | undefined,
): CommunityAtlasPlace[] {
  return (places || []).filter(validPlace);
}
function artUrl(landmark: CommunityAtlasLandmark) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(atlasLandmarkSvg(landmark.kind))}`;
}
// MapLibre step expressions put each threshold before its following color.
const activityColor: ExpressionSpecification = [
  "step",
  ["get", "count"],
  STREET_ACTIVITY_SCALE[0].color,
  ...STREET_ACTIVITY_SCALE.slice(1).flatMap((s) => [s.minimum, s.color]),
];

export function CommunityIllustratedMap({
  geography,
  features,
  practicalStyleUrl,
  mode,
  selectedLandmark,
  cityOnly,
  contextTilesUrl,
  places,
  selectedPlace,
  placeRequest,
  onLandmark,
  onStreet,
  onPlace,
}: {
  geography: CommunityAtlasGeography;
  features: CommunityMapFeature[];
  practicalStyleUrl?: string | null;
  mode: "illustrated" | "practical";
  selectedLandmark?: string;
  cityOnly: boolean;
  contextTilesUrl?: string;
  /** Neighborhood labels inside the community. */
  places?: CommunityAtlasPlace[];
  /** Place the camera is centred on; undefined means the whole community. */
  selectedPlace?: string;
  /** Changes whenever the reader asks for the selected place again (re-centres it). */
  placeRequest?: number;
  onLandmark: (landmark: CommunityAtlasLandmark) => void;
  onStreet: (street: CommunityStreetActivity) => void;
  /** Called with a place when its label is chosen, or undefined for the whole community. */
  onPlace?: (place: CommunityAtlasPlace | undefined) => void;
}) {
  const areaNoun = geography.areaKind || "city";
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<LibreMap>();
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const activity = useMemo(
    () => communityStreetActivity(geography, features),
    [geography, features],
  );
  const usablePlaces = useMemo(() => communityAtlasPlaces(places), [places]);
  const view = communityAtlasView(usablePlaces, selectedPlace);
  const latest = useRef({ activity, onLandmark, onStreet, onPlace, view });
  latest.current = { activity, onLandmark, onStreet, onPlace, view };
  const fitCity = () => {
    instance.current?.fitBounds(geography.bounds, {
      padding: {
        top: 70,
        bottom: 65,
        left: (container.current?.clientWidth || 0) < 600 ? 24 : 60,
        right: (container.current?.clientWidth || 0) < 600 ? 24 : 60,
      },
      duration: 500,
    });
    onPlace?.(undefined);
  };
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setError(false);
    setReady(false);
    async function mount() {
      const lib = await import("maplibre-gl");
      if (disposed || !container.current) return;
      lib.setWorkerUrl(
        `/_scalemule/community-maps/maplibre-gl-worker-${lib.getVersion()}.mjs`,
      );
      const initial = latest.current.view;
      const map = new lib.Map({
        container: container.current,
        style:
          mode === "practical" && practicalStyleUrl
            ? practicalStyleUrl
            : illustratedStyle(geography, contextTilesUrl),
        ...(initial.kind === "place"
          ? { center: initial.center, zoom: initial.zoom }
          : {
              bounds: geography.bounds,
              fitBoundsOptions: {
                padding: {
                  top: 70,
                  bottom: 65,
                  left: (container.current?.clientWidth || 0) < 600 ? 24 : 60,
                  right: (container.current?.clientWidth || 0) < 600 ? 24 : 60,
                },
              },
            }),
        attributionControl: false,
        maxZoom: 18,
        minZoom: 0,
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
      });
      instance.current = map;
      map.addControl(
        new lib.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.touchZoomRotate.disableRotation();
      const markers: InstanceType<typeof lib.Marker>[] = [];
      const markerEntries: {
        button: HTMLButtonElement;
        landmark: CommunityAtlasLandmark;
      }[] = [];
      const placeEntries: {
        button: HTMLButtonElement;
        place: CommunityAtlasPlace;
      }[] = [];
      // Keep map symbols at their real coordinates. Reveal crowded landmarks as
      // the reader zooms, rather than moving them to a fictional location.
      function updateLandmarks() {
        const occupied: {
          left: number;
          right: number;
          top: number;
          bottom: number;
        }[] = [];
        // Neighborhood labels first (the selected one always shows), so names the
        // reader navigates by win over landmark drawings at whole-community zoom.
        const selected = latest.current.view;
        const orderedPlaces = [...placeEntries].sort(
          (a, b) =>
            Number(selected.kind === "place" && b.place.id === selected.id) -
            Number(selected.kind === "place" && a.place.id === selected.id),
        );
        for (const { button, place } of orderedPlaces) {
          button.hidden = false;
          const point = map.project(place.coordinates);
          const box = {
            left: point.x - button.offsetWidth / 2,
            right: point.x + button.offsetWidth / 2,
            top: point.y - button.offsetHeight / 2,
            bottom: point.y + button.offsetHeight / 2,
          };
          const collision = occupied.some(
            (other) =>
              box.left < other.right + 3 &&
              box.right > other.left - 3 &&
              box.top < other.bottom + 3 &&
              box.bottom > other.top - 3,
          );
          button.hidden = collision;
          if (!collision) occupied.push(box);
        }
        for (const { button, landmark } of markerEntries) {
          button.hidden = map.getZoom() < (landmark.minZoom || 0);
          if (button.hidden) continue;
          const point = map.project(landmark.coordinates);
          const box = {
            left: point.x - button.offsetWidth / 2,
            right: point.x + button.offsetWidth / 2,
            top: point.y - button.offsetHeight,
            bottom: point.y,
          };
          const collision = occupied.some(
            (other) =>
              box.left < other.right + 3 &&
              box.right > other.left - 3 &&
              box.top < other.bottom + 3 &&
              box.bottom > other.top - 3,
          );
          button.hidden = collision;
          if (!collision) occupied.push(box);
        }
      }
      const resize = new ResizeObserver(() => {
        map.resize();
        const current = latest.current.view;
        if (current.kind === "place")
          map.jumpTo({ center: current.center, zoom: current.zoom });
        else {
          const side = (container.current?.clientWidth || 0) < 600 ? 24 : 60;
          map.fitBounds(geography.bounds, {
            padding: { top: 70, bottom: 65, left: side, right: side },
            duration: 0,
          });
        }
        updateLandmarks();
      });
      resize.observe(container.current);
      cleanup = () => {
        resize.disconnect();
        markers.forEach((m) => m.remove());
        map.remove();
        if (instance.current === map) instance.current = undefined;
      };
      map.on("load", () => {
        if (disposed) return;
        if (mode === "practical") {
          map.addSource("atlas-city", {
            type: "geojson",
            data: geography.boundary,
          });
          map.addLayer({
            id: "atlas-city-outline",
            type: "line",
            source: "atlas-city",
            paint: {
              "line-color": "#6f7948",
              "line-width": 2,
              "line-dasharray": [3, 3],
            },
          });
        }
        if (mode === "practical" && geography.outsideMask) {
          map.addSource("atlas-outside", {
            type: "geojson",
            data: geography.outsideMask,
          });
          map.addLayer({
            id: "atlas-outside-mask",
            type: "fill",
            source: "atlas-outside",
            paint: { "fill-color": "#eee9cf" },
          });
        }
        map.addSource("street-activity", {
          type: "geojson",
          data: communityStreetGeoJSON(geography, latest.current.activity),
        });
        map.addLayer({
          id: "street-activity-glow",
          type: "line",
          source: "street-activity",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": activityColor,
            "line-width": 17,
            "line-opacity": 0.25,
            "line-blur": 5,
          },
        });
        map.addLayer({
          id: "street-activity-ink",
          type: "line",
          source: "street-activity",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": activityColor,
            "line-width": ["step", ["get", "count"], 4, 2, 5, 5, 6, 10, 7],
          },
        });
        map.on("click", "street-activity-ink", (e) => {
          const street = latest.current.activity.find(
            (s) => s.key === e.features?.[0]?.properties?.key,
          );
          if (street) latest.current.onStreet(street);
        });
        map.on("mouseenter", "street-activity-ink", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "street-activity-ink", () => {
          map.getCanvas().style.cursor = "";
        });
        if (mode === "illustrated") {
          for (const landmark of geography.landmarks) {
            const button = document.createElement("button");
            button.className = "smca-landmark";
            button.type = "button";
            button.dataset.landmark = landmark.id;
            button.setAttribute("aria-label", `About ${landmark.name}`);
            const img = document.createElement("img");
            img.src = artUrl(landmark);
            img.alt = "";
            img.width = 86;
            img.height = 86;
            const label = document.createElement("span");
            label.textContent = landmark.name;
            button.append(img, label);
            button.addEventListener("click", () =>
              latest.current.onLandmark(landmark),
            );
            markerEntries.push({ button, landmark });
            markers.push(
              new lib.Marker({ element: button, anchor: "bottom" })
                .setLngLat(landmark.coordinates)
                .addTo(map),
            );
          }
        }
        // Neighborhood labels: plain text at the real coordinates, in both map styles.
        for (const place of usablePlaces) {
          const button = document.createElement("button");
          button.className = "smca-place";
          button.type = "button";
          button.dataset.place = place.id;
          button.setAttribute("aria-label", `Show ${place.name} on the map`);
          button.textContent = place.name;
          button.addEventListener("click", () =>
            latest.current.onPlace?.(place),
          );
          placeEntries.push({ button, place });
          markers.push(
            new lib.Marker({ element: button, anchor: "center" })
              .setLngLat(place.coordinates)
              .addTo(map),
          );
        }
        map.on("move", updateLandmarks);
        updateLandmarks();
        setReady(true);
      });
      map.on("error", () => {
        if (!disposed) setError(true);
      });
    }
    void mount().catch(() => {
      if (!disposed) setError(true);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [geography, mode, practicalStyleUrl, contextTilesUrl, usablePlaces]);
  // A newly chosen place moves the camera; the whole-community button fits the bounds itself.
  const viewKey =
    view.kind === "place"
      ? `${view.id}:${view.center.join(",")}:${view.zoom}:${placeRequest ?? 0}`
      : "";
  const firstView = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    const current = latest.current.view;
    if (current.kind === "place")
      instance.current?.flyTo({
        center: current.center,
        zoom: current.zoom,
        duration: 700,
      });
  }, [viewKey, ready]);
  useEffect(() => {
    container.current
      ?.querySelectorAll<HTMLButtonElement>("[data-place]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.place === selectedPlace),
        ),
      );
  }, [selectedPlace, ready]);
  useEffect(() => {
    const map = instance.current;
    if (!ready || !map) return;
    if (mode === "illustrated") {
      for (const layer of map.getStyle().layers) {
        if (layer.id.startsWith("context-"))
          map.setLayoutProperty(
            layer.id,
            "visibility",
            cityOnly ? "none" : "visible",
          );
      }
      map.setPaintProperty(
        "paper",
        "background-color",
        cityOnly || !contextTilesUrl ? "#eee9cf" : "#cbd6a0",
      );
      map.setLayoutProperty(
        "city-shadow",
        "visibility",
        cityOnly ? "visible" : "none",
      );
    }
    if (map.getLayer("atlas-outside-mask"))
      map.setLayoutProperty(
        "atlas-outside-mask",
        "visibility",
        cityOnly ? "visible" : "none",
      );
  }, [cityOnly, ready, mode, contextTilesUrl]);
  useEffect(() => {
    if (!ready) return;
    (
      instance.current?.getSource("street-activity") as
        | GeoJSONSource
        | undefined
    )?.setData(communityStreetGeoJSON(geography, activity));
  }, [activity, geography, ready]);
  useEffect(() => {
    container.current
      ?.querySelectorAll<HTMLButtonElement>("[data-landmark]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.landmark === selectedLandmark),
        ),
      );
  }, [selectedLandmark, ready]);
  return (
    <div className={`smca-map-frame smca-map-${mode}`}>
      <div
        ref={container}
        className="smca-map-canvas"
        aria-label={`Whole-${areaNoun} ${mode} map of ${geography.name}`}
      />
      <div className="smca-compass" aria-hidden="true">
        <b>N</b>
        <svg viewBox="0 0 40 50">
          <path d="M20 3 32 43 20 32 8 43Z" fill="#49684c" />
          <path d="M20 3v29L8 43Z" fill="#faf4d8" stroke="#49684c" />
        </svg>
      </div>
      <button type="button" className="smca-reset" onClick={fitCity}>
        ⌖ Whole {areaNoun}
      </button>
      <div className="smca-map-caption" aria-hidden="true">
        <span>A little curiosity. A whole {areaNoun} to explore.</span>
        <strong>{geography.name}</strong>
      </div>
      {!ready && !error && (
        <p className="smca-loading" role="status">
          Unfolding the map…
        </p>
      )}
      {error && (
        <p className="smca-map-error" role="status">
          Some map details could not load. The guide below is still available.
        </p>
      )}
    </div>
  );
}

/** Fetch every public page so the color scale never counts only the first page. */
export async function loadCommunityAtlasFeatures(
  client: CommunityMapsClient,
  slug: string,
  areaId: string,
  signal: AbortSignal,
) {
  const all = new Map<string, CommunityMapFeature>();
  const cursors = new Set<string>();
  let after: string | undefined;
  do {
    const page = await client.features(
      slug,
      { area_id: areaId, limit: 200, after },
      signal,
    );
    for (const feature of page.items)
      if (feature.area_id === areaId) all.set(feature.id, feature);
    after = page.next_cursor || undefined;
    if (after && cursors.has(after))
      throw new Error("The guide could not finish loading. Please try again.");
    if (after) cursors.add(after);
  } while (after);
  return [...all.values()];
}

export function CommunityCityGuide({
  client,
  collection,
  atlas,
  submitHref,
  featureHref,
  signInHref,
  communityHref,
}: {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  atlas: CommunityCityAtlasConfig;
  submitHref: string;
  signInHref?: (feature: CommunityMapFeature) => string;
  featureHref: (feature: CommunityMapFeature) => string;
  communityHref: (areaId: string) => string;
}) {
  const [geography, setGeography] = useState<CommunityAtlasGeography>();
  const [features, setFeatures] = useState<CommunityMapFeature[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cityOnly, setCityOnly] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const selection = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"illustrated" | "practical">("illustrated");
  const [landmark, setLandmark] = useState<CommunityAtlasLandmark>();
  const [selectedStreet, setStreet] = useState<CommunityStreetActivity>();
  const places = useMemo(
    () => communityAtlasPlaces(atlas.places),
    [atlas.places],
  );
  const initialView = communityAtlasView(places, atlas.focusPlace);
  const [placeId, setPlaceId] = useState<string | undefined>(
    initialView.kind === "place" ? initialView.id : undefined,
  );
  const [placeRequest, setPlaceRequest] = useState(0);
  const choosePlace = (id: string | undefined) => {
    setPlaceId(id);
    if (id) setPlaceRequest((v) => v + 1);
  };
  useEffect(() => {
    const next = communityAtlasView(places, atlas.focusPlace);
    setPlaceId(next.kind === "place" ? next.id : undefined);
  }, [places, atlas.focusPlace, atlas.areaSlug]);
  const area = collection.areas.find((a) => a.slug === atlas.areaSlug);
  const areaId = area?.id;
  const areaNoun =
    area?.kind === "CITY" || area?.kind === "TOWN" ? "city" : "community";
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setError(undefined);
    setFeatures([]);
    setGeography(undefined);
    setLandmark(undefined);
    setStreet(undefined);
    async function load() {
      if (!areaId)
        throw new Error(
          "This community is not part of the guide’s publication coverage.",
        );
      const response = await fetch(atlas.geographyUrl, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error("The community map could not load. Please try again.");
      const data = (await response.json()) as CommunityAtlasGeography;
      if (
        data.areaSlug !== atlas.areaSlug ||
        !data.boundary?.features?.length ||
        data.bounds?.length !== 4
      )
        throw new Error("The community geography is unavailable.");
      if (!controller.signal.aborted) setGeography(data);
      const records = await loadCommunityAtlasFeatures(
        client,
        collection.slug,
        areaId,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setFeatures(records);
        setLoaded(true);
      }
    }
    void load().catch((e) => {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "The guide could not load.");
    });
    return () => controller.abort();
  }, [
    client,
    collection.slug,
    atlas.areaSlug,
    atlas.geographyUrl,
    areaId,
    retry,
  ]);
  useEffect(() => {
    if (
      (landmark || selectedStreet) &&
      window.matchMedia("(max-width: 600px)").matches
    )
      selection.current?.scrollIntoView({ block: "nearest" });
  }, [landmark, selectedStreet]);
  const streets = useMemo(
    () => (geography ? communityStreetActivity(geography, features) : []),
    [geography, features],
  );
  return (
    <section
      className="smca"
      aria-label={`${area?.name || "Community"} community guide`}
    >
      <header className="smca-heading">
        <div>
          <p className="smca-kicker">
            The neighborhood field guide · {collection.config.title}
          </p>
          <h1>
            {area?.name || "Your community"}, <em>come explore.</em>
          </h1>
          <p>
            Find the festive streets. Discover a new corner of town. Make a
            night of it.
          </p>
        </div>
        {collection.config.submissions_open && (
          <a className="smca-submit" href={submitHref}>
            ＋ Share a street or place
          </a>
        )}
      </header>
      {geography?.visitorNote && (
        <p className="smca-visitor-note">
          {geography.visitorNote.text}{" "}
          <a href={geography.visitorNote.url} target="_blank" rel="noreferrer">
            Visitor information ↗
          </a>
        </p>
      )}
      <nav className="smca-toolbar" aria-label="Community and map view">
        <div className="smca-communities">
          {[
            ...(area ? [area] : []),
            ...collection.areas.filter((a) => a.id !== area?.id),
          ].map((a) => (
            <a
              key={a.id}
              href={communityHref(a.id)}
              aria-current={a.id === area?.id ? "page" : undefined}
            >
              {a.name}
            </a>
          ))}
        </div>
        <label className="smca-city-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={cityOnly}
            onChange={(event) => setCityOnly(event.target.checked)}
          />
          <span>{area?.name || "Community"} only</span>
        </label>
        <div className="smca-modes" role="group" aria-label="Map style">
          <button
            type="button"
            aria-pressed={mode === "illustrated"}
            onClick={() => setMode("illustrated")}
          >
            Illustrated
          </button>
          <button
            type="button"
            aria-pressed={mode === "practical"}
            onClick={() => setMode("practical")}
          >
            Street map
          </button>
        </div>
      </nav>
      {places.length > 0 && (
        <nav
          className="smca-places"
          aria-label={`Neighborhoods in ${area?.name || "this community"}`}
        >
          <span className="smca-small-cap" aria-hidden="true">
            Neighborhoods
          </span>
          <div>
            {places.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === placeId}
                onClick={() => choosePlace(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </nav>
      )}
      <div className="smca-atlas">
        <aside className="smca-sidebar" aria-label="Map guide">
          <div className="smca-field-note">
            <span className="smca-small-cap">
              Your {areaNoun}, all together
            </span>
            <h2>
              Follow the <br />
              <em>festive streets.</em>
            </h2>
            <p>
              The whole {areaNoun} is here. As places are approved, their
              streets light up with color.
            </p>
          </div>
          <div className="smca-legend">
            <h3>More places. Richer color.</h3>
            <div className="smca-swatches">
              {STREET_ACTIVITY_SCALE.map((s) => (
                <div key={s.minimum}>
                  <span style={{ background: s.color }} />
                  <b>{s.label}</b>
                </div>
              ))}
            </div>
            <p>Approved places per street</p>
          </div>
          <div className="smca-count">
            <strong>{loaded ? streets.length : "—"}</strong>
            <span>
              festive {streets.length === 1 ? "street" : "streets"}
              <small>
                {loaded
                  ? `${features.length} approved ${features.length === 1 ? "place" : "places"} in ${area?.name || "this community"}`
                  : "Loading the latest places…"}
              </small>
            </span>
          </div>
          <p className="smca-privacy">
            <span aria-hidden="true">⌂</span> Streets glow. Home addresses stay
            private.
          </p>
          {landmark ? (
            <div ref={selection} className="smca-selection" aria-live="polite">
              <span className="smca-small-cap">A local landmark</span>
              <img src={artUrl(landmark)} alt="" width="74" height="74" />
              <h3>{landmark.name}</h3>
              <p>{landmark.description}</p>
              <small>
                A landmark for finding your way; not a listed seasonal
                attraction.
              </small>
              <button type="button" onClick={() => setLandmark(undefined)}>
                Back to the guide
              </button>
            </div>
          ) : selectedStreet ? (
            <div ref={selection} className="smca-selection" aria-live="polite">
              <span className="smca-small-cap">A festive street</span>
              <h3>{selectedStreet.name}</h3>
              <ul>
                {selectedStreet.features.map((f) => (
                  <li key={f.id}>
                    <a href={featureHref(f)}>{f.content.title}</a>
                    {collection.config.voting_enabled && (
                      <CommunityVote
                        key={f.id}
                        client={client}
                        slug={collection.slug}
                        featureId={f.id}
                        signInHref={signInHref?.(f)}
                        compact
                      />
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setStreet(undefined)}>
                Back to the guide
              </button>
            </div>
          ) : (
            <div className="smca-help">
              <span aria-hidden="true">✦</span>
              <p>
                Choose a drawing to meet a local landmark. Zoom in to explore
                the streets.
              </p>
            </div>
          )}
        </aside>
        {geography ? (
          <CommunityIllustratedMap
            geography={geography}
            features={features}
            practicalStyleUrl={collection.config.presentation.map_style_url}
            mode={mode}
            cityOnly={cityOnly}
            contextTilesUrl={atlas.contextTilesUrl}
            selectedLandmark={landmark?.id}
            {...(places.length
              ? {
                  places,
                  selectedPlace: placeId,
                  placeRequest,
                  onPlace: (value: CommunityAtlasPlace | undefined) =>
                    choosePlace(value?.id),
                }
              : {})}
            onLandmark={(value) => {
              setLandmark(value);
              setStreet(undefined);
            }}
            onStreet={(value) => {
              setStreet(value);
              setLandmark(undefined);
            }}
          />
        ) : (
          <div className="smca-map-placeholder" role="status">
            {error || "Unfolding the map…"}
          </div>
        )}
      </div>
      <div className="smca-map-footer">
        <span>
          © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>{" "}
          · <a href="https://openfreemap.org/">OpenFreeMap</a> / OpenMapTiles ·
          <a href="#community-map-sources">Geographic sources</a>
        </span>
        <span>
          Use two fingers to move the map on your phone · ⌖ to see the whole{" "}
          {areaNoun}
        </span>
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Reload guide
          </button>
        </div>
      )}
      <section
        className="smca-discover"
        aria-labelledby="smca-discover-heading"
      >
        <div>
          <p className="smca-kicker">Made by the neighborhood</p>
          <h2 id="smca-discover-heading">
            A great night starts with a local tip.
          </h2>
          <p>
            {loaded && !features.length
              ? "Be part of the first wave. Share a decorated street, a neighborhood display or a public attraction. Approved places will bring this map to life."
              : "Explore approved places and share a festive find with your neighbors."}
          </p>
        </div>
        {collection.config.submissions_open && (
          <a className="smca-submit" href={submitHref}>
            Share a street or place
          </a>
        )}
      </section>
      {streets.length > 0 && (
        <div className="smca-street-list">
          {streets.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setStreet(s);
                setLandmark(undefined);
              }}
            >
              <strong>{s.name}</strong>
              <span>
                {s.count} approved {s.count === 1 ? "place" : "places"} ↗
              </span>
            </button>
          ))}
        </div>
      )}
      {features.length > 0 && (
        <section className="smca-place-list" aria-label="Approved places">
          <h2>Places in this guide</h2>
          <ul>
            {features.map((f) => (
              <li key={f.id}>
                <a href={featureHref(f)}>{f.content.title}</a>
                {collection.config.voting_enabled && (
                  <CommunityVote
                    key={f.id}
                    client={client}
                    slug={collection.slug}
                    featureId={f.id}
                    signInHref={signInHref?.(f)}
                    compact
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {geography && (
        <details id="community-map-sources" className="smca-sources">
          <summary>About this map & geographic sources</summary>
          <p>
            {geography.boundaryDescription ||
              "The city outline uses Census geography."}{" "}
            Streets, parks and landmark locations come from public geographic
            reference data. Illustrations are symbols anchored to those
            locations. Street color counts unique approved places; contributions
            and reactions do not increase that count. Streets without a matched
            approved public street label remain uncolored.
          </p>
          <ul>
            {geography.sources.map((s) => (
              <li key={s.title}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>{" "}
                — {s.attribution}. Retrieved {s.retrieved}.
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
