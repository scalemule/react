import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserFamily,
  CommunityRequestError,
  createCommunityMapsBrowserClient,
} from "./client";
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
class FakeXhr {
  static next: { status: number; body: string } | "error";
  status = 0;
  responseText = "";
  timeout = 0;
  withCredentials = false;
  upload = { onprogress: null };
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  open() {}
  abort() {}
  send() {
    const next = FakeXhr.next;
    queueMicrotask(() => {
      if (next === "error") return this.onerror?.();
      this.status = next.status;
      this.responseText = next.body;
      this.onload?.();
    });
  }
}
describe("failures carry what the reader and editors need", () => {
  const upload = () =>
    createCommunityMapsBrowserClient().upload(
      "gardens",
      "submission",
      new File(["x"], "a.jpg", { type: "image/jpeg" }),
      {
        caption: "",
        attribution: "",
        rights_confirmed: true,
        consent_version: "v",
      },
    );
  it("reports an HTML error page by its real status and does not mark it retryable", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    FakeXhr.next = {
      status: 413,
      body: "<html>Request Entity Too Large</html>",
    };
    const error = await upload().catch((e) => e);
    expect(error).toBeInstanceOf(CommunityRequestError);
    expect(error.status).toBe(413);
    expect(error.retryable).toBe(false);
  });
  it("treats a lost success body and a dropped connection as retryable", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    FakeXhr.next = { status: 200, body: "" };
    expect(await upload().catch((e) => e)).toMatchObject({
      status: 502,
      retryable: true,
    });
    FakeXhr.next = "error";
    expect(await upload().catch((e) => e)).toMatchObject({
      status: 0,
      retryable: true,
    });
  });
  it("keeps the server's reference and retry hint", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    FakeXhr.next = {
      status: 503,
      body: JSON.stringify({
        error: { message: "busy", retryable: true, reference: "cm_ab12cd34" },
      }),
    };
    expect(await upload().catch((e) => e)).toMatchObject({
      status: 503,
      retryable: true,
      reference: "cm_ab12cd34",
    });
  });
  it("falls back to fetch when sendBeacon throws", () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("navigator", {
      ...navigator,
      sendBeacon: () => {
        throw new TypeError("type not allowed");
      },
    });
    createCommunityMapsBrowserClient().diagnose!("gardens", {
      kind: "upload_failed",
      stage: "upload",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toMatch(
      /collections\/gardens\/diagnostics$/,
    );
  });
  it("names the browser family coarsely", () => {
    expect(
      browserFamily(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]",
      ),
    ).toBe("Facebook app · iOS 18");
    expect(
      browserFamily(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 EdgA/130.0",
      ),
    ).toBe("Edge · Android");
  });
});
