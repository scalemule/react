import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { indexedDB, IDBObjectStore } from "fake-indexeddb";
import {
  CaptureDraftStore,
  CaptureQueueConflict,
  type CaptureDraft,
} from "./capture-draft";
afterEach(() => {
  vi.restoreAllMocks();
});
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
    ).rejects.toBeInstanceOf(CaptureQueueConflict);
    expect((await a.load(key))?.location).toBe("New street");
    a.close();
    b.close();
  });
  it("stores photo bytes, not a File, and restores name, type and content", async () => {
    const key = crypto.randomUUID(),
      store = new CaptureDraftStore();
    await store.open();
    const name = "Улица 🎄 снимка.jpg";
    expect(
      await store.save(
        {
          ...draft(key),
          files: [{ id: "a", name, size: 5, type: "image/jpeg" }],
        },
        { id: "a", file: new File(["bytes"], name, { type: "image/jpeg" }) },
      ),
    ).toBe("device");
    store.close();
    const again = new CaptureDraftStore();
    await again.open();
    const file = await again.file(key, "a");
    expect(file?.name).toBe(name);
    expect(file?.type).toBe("image/jpeg");
    expect(await file?.text()).toBe("bytes");
    again.close();
  });
  it("keeps the queue in memory when the browser refuses device storage", async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "files")
        throw new DOMException("refused", "DataCloneError");
      return put.apply(this, args);
    });
    const key = crypto.randomUUID(),
      store = new CaptureDraftStore();
    await store.open();
    const input = {
      ...draft(key),
      files: [{ id: "a", name: "a.jpg", size: 1, type: "image/jpeg" }],
    };
    expect(
      await store.save(input, { id: "a", file: new File(["x"], "a.jpg") }),
    ).toBe("memory");
    expect(store.memoryOnly).toBe(true);
    expect((await store.load(key))?.files).toHaveLength(1);
    expect(await (await store.file(key, "a"))?.text()).toBe("x");
    expect(
      await store.save({ ...input, revision: 2, files: [] }, undefined, "a"),
    ).toBe("memory");
    expect(await store.file(key, "a")).toBeUndefined();
    store.close();
  });
  it("keeps a page-only queue for a re-mounted form", async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "files")
        throw new DOMException("quota", "QuotaExceededError");
      return put.apply(this, args);
    });
    const key = crypto.randomUUID(),
      first = new CaptureDraftStore();
    await first.open();
    const input = {
      ...draft(key),
      files: [{ id: "a", name: "a.jpg", size: 1, type: "image/jpeg" }],
    };
    expect(
      await first.save(input, { id: "a", file: new File(["x"], "a.jpg") }),
    ).toBe("memory");
    first.close();
    const second = new CaptureDraftStore();
    await second.open();
    expect((await second.load(key))?.files).toHaveLength(1);
    expect(second.memoryOnly).toBe(true);
    expect(await (await second.file(key, "a"))?.text()).toBe("x");
    second.close();
  });
  it("reconnects once when Safari dropped the storage connection", async () => {
    const key = crypto.randomUUID(),
      store = new CaptureDraftStore();
    await store.open();
    (store as unknown as { db: IDBDatabase }).db.close();
    expect(
      await store.save(
        {
          ...draft(key),
          files: [{ id: "a", name: "a.jpg", size: 1, type: "image/jpeg" }],
        },
        { id: "a", file: new File(["x"], "a.jpg") },
      ),
    ).toBe("device");
    expect(store.memoryOnly).toBe(false);
    expect(await (await store.file(key, "a"))?.text()).toBe("x");
    store.close();
  });
});
