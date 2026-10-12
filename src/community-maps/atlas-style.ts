import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { CommunityAtlasGeography } from "./atlas-data";

/** Context tiles use the published OpenMapTiles schema; the application chooses the provider. */
function contextLayers(): LayerSpecification[] {
  return [
    {
      id: "context-land",
      type: "fill",
      source: "context",
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          ["wood", "forest"],
          "#91ad6e",
          "#c2d18e",
        ],
        "fill-opacity": 0.7,
      },
    },
    {
      id: "context-parks",
      type: "fill",
      source: "context",
      "source-layer": "park",
      paint: { "fill-color": "#a9c47b", "fill-opacity": 0.65 },
    },
    {
      id: "context-water",
      type: "fill",
      source: "context",
      "source-layer": "water",
      paint: { "fill-color": "#8ec9ca" },
    },
    {
      id: "context-creeks",
      type: "line",
      source: "context",
      "source-layer": "waterway",
      paint: { "line-color": "#7db5b9", "line-width": 1.3 },
    },
    {
      id: "context-road-edges",
      type: "line",
      source: "context",
      "source-layer": "transportation",
      filter: [
        "!",
        ["in", ["get", "class"], ["literal", ["rail", "aerialway", "ferry"]]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#a2b57a",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          1.5,
          14,
          6,
          17,
          15,
        ],
      },
    },
    {
      id: "context-roads",
      type: "line",
      source: "context",
      "source-layer": "transportation",
      filter: [
        "!",
        ["in", ["get", "class"], ["literal", ["rail", "aerialway", "ferry"]]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#f6eec7",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          0.7,
          14,
          3.8,
          17,
          11,
        ],
      },
    },
    {
      id: "context-road-names",
      type: "symbol",
      source: "context",
      "source-layer": "transportation_name",
      minzoom: 12,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 280,
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-max-angle": 25,
      },
      paint: {
        "text-color": "#647251",
        "text-halo-color": "#f7f0d5",
        "text-halo-width": 1.6,
      },
    },
  ];
}

export function illustratedStyle(
  geography: CommunityAtlasGeography,
  contextTilesUrl?: string,
): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      city: { type: "geojson", data: geography.boundary },
      land: { type: "geojson", data: geography.land },
      water: { type: "geojson", data: geography.water },
      roads: { type: "geojson", data: geography.streets },
    },
    layers: [
      {
        id: "paper",
        type: "background",
        paint: { "background-color": "#eee9cf" },
      },
      {
        id: "city-shadow",
        type: "line",
        source: "city",
        paint: { "line-color": "#d3cfac", "line-width": 12, "line-blur": 5 },
      },
      {
        id: "city-meadow",
        type: "fill",
        source: "city",
        paint: { "fill-color": "#c1d58b" },
      },
      {
        id: "green-spaces",
        type: "fill",
        source: "land",
        paint: {
          "fill-color": [
            "match",
            ["get", "class"],
            ["wood", "forest"],
            "#7f9e60",
            "park",
            "#9cbd67",
            "#acc879",
          ],
          "fill-opacity": 0.8,
        },
      },
      {
        id: "green-edges",
        type: "line",
        source: "land",
        paint: {
          "line-color": "#7a9d58",
          "line-width": 0.6,
          "line-opacity": 0.5,
        },
      },
      {
        id: "water-fill",
        type: "fill",
        source: "water",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#8ec9ca" },
      },
      {
        id: "water-lines",
        type: "line",
        source: "water",
        paint: { "line-color": "#7db5b9", "line-width": 1.3 },
      },
      {
        id: "road-edge",
        type: "line",
        source: "roads",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#98aa70",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            1.5,
            14,
            6,
            17,
            15,
          ],
        },
      },
      {
        id: "road-paper",
        type: "line",
        source: "roads",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f6eec7",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            0.7,
            14,
            3.8,
            17,
            11,
          ],
        },
      },
      {
        id: "major-roads",
        type: "line",
        source: "roads",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["primary", "secondary", "trunk", "motorway"]],
        ],
        paint: {
          "line-color": "#f6e5b3",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            2,
            14,
            6,
            17,
            15,
          ],
        },
      },
      {
        id: "city-stitch",
        type: "line",
        source: "city",
        paint: {
          "line-color": "#738c53",
          "line-width": 1.5,
          "line-dasharray": [3, 3],
        },
      },
      {
        id: "street-names",
        type: "symbol",
        source: "roads",
        minzoom: 11,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["primary", "secondary", "trunk"]],
        ],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 220,
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 13],
          "text-max-angle": 25,
        },
        paint: {
          "text-color": "#576446",
          "text-halo-color": "#f7f0d5",
          "text-halo-width": 1.6,
        },
      },
      {
        id: "local-street-names",
        type: "symbol",
        source: "roads",
        minzoom: 13,
        filter: [
          "!",
          [
            "in",
            ["get", "class"],
            ["literal", ["primary", "secondary", "trunk"]],
          ],
        ],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 220,
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 13],
          "text-max-angle": 25,
        },
        paint: {
          "text-color": "#576446",
          "text-halo-color": "#f7f0d5",
          "text-halo-width": 1.6,
        },
      },
    ],
  };
  if (contextTilesUrl) {
    style.sources.context = { type: "vector", url: contextTilesUrl };
    style.layers.splice(1, 0, ...contextLayers());
    style.layers.push({
      id: "context-place-labels",
      type: "symbol",
      source: "context",
      "source-layer": "place",
      minzoom: 9,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["city", "town", "village", "suburb", "neighbourhood"]],
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 16],
        "text-letter-spacing": 0.07,
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#617050",
        "text-halo-color": "#eee9cf",
        "text-halo-width": 2,
      },
    });
  }
  return style;
}
