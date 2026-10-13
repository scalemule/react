import { beforeEach, describe, it, expect } from "vitest";
import { indexedDB } from "fake-indexeddb";
import { CaptureDraftStore, type CaptureDraft } from "./capture-draft";
const draft = (key: string): CaptureDraft => ({
  key,
  updated: Date.now(),
  revision: 1,
  area: "area",
  location: "Улица 🎃",
  category: "street",
  title: "",
  description: "",
  hours: "",
  caption: "",
  attribution: "",
  files: [],
});
beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", {
    value: indexedDB,
    configurable: true,
  });
});
describe("private capture queue persistence", () => {
  it("restores a pending file after reload and atomically removes bytes after receipt", async () => {
    const key = crypto.randomUUID(),
      first = new CaptureDraftStore();
    expect(await first.open()).toBe(true);
    const input = {
      ...draft(key),
      files: [{ id: "one", name: "street.png", size: 3, type: "image/png" }],
    };
    await first.save(input, {
      id: "one",
      file: new File(["png"], "street.png", { type: "image/png" }),
    });
    first.close();
    const second = new CaptureDraftStore();
    await second.open();
    expect((await second.load(key))?.location).toBe("Улица 🎃");
    expect(await second.file(key, "one")).toBeDefined();
    expect(await second.load("different-reader")).toBeUndefined();
    await second.save({ ...input, revision: 2, files: [] }, undefined, "one");
    expect(await second.file(key, "one")).toBeUndefined();
    second.close();
  });
  it("rejects a stale tab instead of overwriting another tab's saved photo queue", async () => {
    const key = crypto.randomUUID(),
      a = new CaptureDraftStore(),
      b = new CaptureDraftStore();
    await a.open();
    await b.open();
    await a.save(draft(key));
    await a.save({ ...draft(key), revision: 2, location: "New street" });
    await expect(
      b.save({ ...draft(key), revision: 2, location: "Stale street" }),
    ).rejects.toThrow("Reload");
    expect((await a.load(key))?.location).toBe("New street");
    a.close();
    b.close();
  });
});
