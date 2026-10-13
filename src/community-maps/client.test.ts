import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommunityMapsBrowserClient } from "./client";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("public guide connection recovery", () => {
  it("bounds a stalled request without retrying a write automatically", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const request = createCommunityMapsBrowserClient().react(
      "gardens",
      "place",
      "heart",
      true,
    );
    const assertion = expect(request).rejects.toThrow("Check your connection");
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves caller cancellation and clears its timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener("abort", () =>
              reject(options.signal?.reason),
            );
          }),
      ),
    );
    const abort = new AbortController();
    const request = createCommunityMapsBrowserClient().collection(
      "gardens",
      abort.signal,
    );
    const assertion = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    abort.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
