import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { CommunityMapCollection } from "@scalemule/sdk";
import {
  CommunityCityGuide,
  communityAtlasPlaces,
  communityAtlasView,
  type CommunityAtlasPlace,
} from "./atlas";
import type { CommunityMapsClient } from "./client";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const places: CommunityAtlasPlace[] = [
  { id: "round-hill", name: "Round Hill", coordinates: [-122.004, 37.855] },
  {
    id: "bryan-ranch",
    name: "Bryan Ranch",
    coordinates: [-121.99, 37.84],
    zoom: 16,
  },
  { id: "стара-загора", name: "Стара Загора 🎄", coordinates: [25.6, 42.4] },
];

describe("communityAtlasView", () => {
  it("centres on the focused place at zoom 15 by default", () => {
    expect(communityAtlasView(places, "round-hill")).toEqual({
      kind: "place",
      id: "round-hill",
      center: [-122.004, 37.855],
      zoom: 15,
    });
  });
  it("uses the place's own zoom, clamped to the map's range", () => {
    expect(communityAtlasView(places, "bryan-ranch")).toMatchObject({
      zoom: 16,
    });
    expect(
      communityAtlasView([{ ...places[0], zoom: 40 }], "round-hill"),
    ).toMatchObject({ zoom: 18 });
  });
  it("fits the whole community for an unknown, missing or unusable focus", () => {
    expect(communityAtlasView(places, "nowhere")).toEqual({ kind: "bounds" });
    expect(communityAtlasView(places, undefined)).toEqual({ kind: "bounds" });
    expect(communityAtlasView(undefined, "round-hill")).toEqual({
      kind: "bounds",
    });
    const broken = [
      { id: "x", name: "X", coordinates: [Number.NaN, 37] as [number, number] },
    ];
    expect(communityAtlasView(broken, "x")).toEqual({ kind: "bounds" });
    expect(communityAtlasPlaces(broken)).toEqual([]);
  });
  it("supports non-Latin place names and ids", () => {
    expect(communityAtlasView(places, "стара-загора")).toMatchObject({
      kind: "place",
      center: [25.6, 42.4],
    });
  });
});

const collection = {
  slug: "holiday-lights-2026",
  areas: [
    {
      id: "alamo",
      slug: "us-ca-alamo",
      name: "Alamo",
      kind: "COMMUNITY",
      country_code: "US",
      geometry: null,
    },
  ],
  config: {
    title: "Christmas & Holiday Lights 2026",
    submissions_open: true,
    voting_enabled: false,
    presentation: { map_style_url: null },
  },
} as unknown as CommunityMapCollection;
const client = {
  features: vi.fn(() => new Promise(() => {})),
} as unknown as CommunityMapsClient;

function guide(atlas: Record<string, unknown>) {
  // The geography request never settles, so no map engine loads in this test.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  return render(
    <CommunityCityGuide
      client={client}
      collection={collection}
      atlas={{
        geographyUrl: "/community-maps/alamo-atlas.json",
        areaSlug: "us-ca-alamo",
        ...atlas,
      }}
      submitHref="/holiday-lights/submit"
      featureHref={() => "/x"}
      communityHref={(id) => `/holiday-lights/map?area=${id}`}
    />,
  );
}

describe("neighborhoods inside a community guide", () => {
  it("lists every place in order and marks the focused one", () => {
    guide({ places, focusPlace: "bryan-ranch" });
    const row = screen.getByRole("navigation", {
      name: "Neighborhoods in Alamo",
    });
    const buttons = Array.from(row.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Round Hill",
      "Bryan Ranch",
      "Стара Загора 🎄",
    ]);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");
  });
  it("selects nothing when the focus is unknown", () => {
    guide({ places, focusPlace: "nowhere" });
    const row = screen.getByRole("navigation", {
      name: "Neighborhoods in Alamo",
    });
    expect(
      Array.from(row.querySelectorAll("button")).every(
        (b) => b.getAttribute("aria-pressed") === "false",
      ),
    ).toBe(true);
  });
  it("renders no neighborhood row without places", () => {
    const { container } = guide({});
    expect(screen.queryByText("Neighborhoods")).toBeNull();
    expect(container.querySelector(".smca-places")).toBeNull();
    const empty = guide({ places: [] });
    expect(empty.container.querySelector(".smca-places")).toBeNull();
  });
});
