import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { CommunityCards, CommunityReaction } from "./components";
import {
  createCommunityMapsBrowserClient,
  type CommunityMapsClient,
} from "./client";
import type {
  CommunityMapCollection,
  CommunityMapFeature,
} from "@scalemule/sdk";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("reusable Community Maps UI", () => {
  it("renders international community names as filter links", () => {
    render(
      <CommunityCards
        areas={[
          {
            id: "area",
            name: "София 🏠",
            slug: "bg-sofia",
            kind: "CITY",
            country_code: "BG",
            geometry: null,
          },
        ]}
        href={(a) => "/public-art?area=" + a.id}
      />,
    );
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/public-art?area=area",
    );
    expect(screen.getByText("София 🏠")).toBeTruthy();
  });
  it("uses confirmed reaction counts and disables duplicate requests while pending", async () => {
    let finish: (value: { count: number; active: boolean }) => void = () => {};
    const react = vi.fn(
      () =>
        new Promise<{ count: number; active: boolean }>((resolve) => {
          finish = resolve;
        }),
    );
    const client = { react } as unknown as CommunityMapsClient;
    const collection = {
      slug: "holiday-lights",
      config: {
        reactions: [{ key: "star", label: "Give a Star", icon: "⭐" }],
      },
    } as CommunityMapCollection;
    render(
      <CommunityReaction
        client={client}
        collection={collection}
        feature={
          {
            id: "feature",
            reactions: { star: 2 },
          } as unknown as CommunityMapFeature
        }
      />,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(react).toHaveBeenCalledTimes(1);
    finish({ count: 3, active: true });
    await waitFor(() =>
      expect(button.getAttribute("aria-pressed")).toBe("true"),
    );
    expect(button.textContent).toContain("3");
  });
  it("keeps browser requests same-origin and no-store", async () => {
    expect(() => createCommunityMapsBrowserClient("//attacker.test")).toThrow();
    const fetch = vi.fn(async (_url: string, _options?: RequestInit) =>
      Response.json({ data: { items: [], next_cursor: null } }),
    );
    vi.stubGlobal("fetch", fetch);
    await createCommunityMapsBrowserClient().features("public-art", {
      featured: false,
    });
    expect(fetch.mock.calls[0][0]).toBe(
      "/api/community-maps/collections/public-art/features?featured=false",
    );
    expect(fetch.mock.calls[0][1]).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
    });
  });
});
