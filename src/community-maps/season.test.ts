import { describe, expect, it } from "vitest";
import type { CommunityMapCollection } from "@scalemule/sdk";
import { communitySubmissionsOpen } from "./season";
describe("collection submission window", () => {
  const collection = {
    config: {
      submissions_open: true,
      starts_at: "2026-11-20T08:00:00Z",
      ends_at: "2027-01-07T08:00:00Z",
    },
  } as CommunityMapCollection;
  it("accepts early contributions and closes at the configured end without deleting anything", () => {
    expect(
      communitySubmissionsOpen(collection, Date.parse("2026-11-02T08:00:00Z")),
    ).toBe(true);
    expect(
      communitySubmissionsOpen(
        collection,
        Date.parse("2027-01-07T07:59:59.999Z"),
      ),
    ).toBe(true);
    expect(
      communitySubmissionsOpen(collection, Date.parse("2027-01-07T08:00:00Z")),
    ).toBe(false);
    expect(
      communitySubmissionsOpen(
        {
          ...collection,
          config: { ...collection.config, submissions_open: false },
        },
        Date.parse("2026-12-25"),
      ),
    ).toBe(false);
  });
});
