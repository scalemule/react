import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversionBar, useConversionBar } from "./conversion-bar";
import {
  conversionBarStorageKey,
  conversionBarSuppressedByState,
  markConversionBarConverted,
  markConversionBarDismissed,
  readConversionBarState,
} from "./storage";

const DAY = 86_400_000;

// Node's own experimental localStorage shadows jsdom's; give each test a plain in-memory Storage.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => { data.delete(key); },
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
  };
}

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  window.dispatchEvent(new Event("scroll"));
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  window.history.replaceState(null, "", "/news/a-story");
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  setScroll(0);
  document.documentElement.style.removeProperty("--sm-conversion-bar-height");
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("storage", () => {
  it("remembers dismissals for the configured days and conversions for good", () => {
    const now = Date.UTC(2026, 9, 29);
    markConversionBarDismissed("n", now);
    expect(conversionBarSuppressedByState(readConversionBarState("n"), 14, now + 13 * DAY)).toBe(true);
    expect(conversionBarSuppressedByState(readConversionBarState("n"), 14, now + 15 * DAY)).toBe(false);
    markConversionBarConverted("n", now);
    expect(conversionBarSuppressedByState(readConversionBarState("n"), 14, now + 400 * DAY)).toBe(true);
  });

  it("ignores corrupt or foreign values", () => {
    window.localStorage.setItem(conversionBarStorageKey("n"), "{not json");
    expect(readConversionBarState("n")).toEqual({});
    window.localStorage.setItem(conversionBarStorageKey("n"), JSON.stringify({ dismissedAt: "yesterday", convertedAt: null }));
    expect(readConversionBarState("n")).toEqual({});
  });
});

describe("ConversionBar", () => {
  it("waits for scroll intent, then shows once and reports the view", () => {
    const onView = vi.fn();
    render(<ConversionBar id="n" title="Get the briefing" onView={onView} trigger={{ viewportHeights: 1 }} />);
    expect(screen.queryByText("Get the briefing")).toBeNull();
    act(() => setScroll(500));
    expect(screen.queryByText("Get the briefing")).toBeNull();
    act(() => setScroll(900));
    expect(screen.getByRole("region")).toBeTruthy();
    expect(screen.getByText("Get the briefing")).toBeTruthy();
    act(() => setScroll(2000));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it("arms from reading progress through a target element", () => {
    const article = document.createElement("article");
    article.setAttribute("data-conversion-target", "");
    document.body.appendChild(article);
    let top = 200;
    article.getBoundingClientRect = () => ({ top, height: 4000, bottom: top + 4000, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} }) as DOMRect;
    render(<ConversionBar id="n" title="Read on" trigger={{ target: "[data-conversion-target]", targetFraction: 0.35 }} />);
    expect(screen.queryByText("Read on")).toBeNull();
    top = -600; // (800 + 600) / 4000 = 0.35
    act(() => setScroll(800));
    expect(screen.getByText("Read on")).toBeTruthy();
  });

  it("never shows on excluded paths or when the app suppresses it", () => {
    const { rerender } = render(<ConversionBar id="n" title="Hidden" pathname="/newsletter" excludePaths={[/^\/newsletter/]} trigger={{ immediate: true }} />);
    expect(screen.queryByText("Hidden")).toBeNull();
    rerender(<ConversionBar id="n" title="Hidden" pathname="/news/x" suppressed trigger={{ immediate: true }} />);
    expect(screen.queryByText("Hidden")).toBeNull();
    cleanup();
    render(<ConversionBar id="n" title="Hidden" suppressWhen={() => true} trigger={{ immediate: true }} />);
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("dismissal hides it, records the day and keeps it away on the next page", () => {
    const onDismiss = vi.fn();
    render(<ConversionBar id="n" title="Briefing" onDismiss={onDismiss} trigger={{ immediate: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Briefing")).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(readConversionBarState("n").dismissedAt).toBeTypeOf("number");
    cleanup();
    render(<ConversionBar id="n" title="Briefing" trigger={{ immediate: true }} />);
    expect(screen.queryByText("Briefing")).toBeNull();
  });

  it("Escape inside the bar dismisses it", () => {
    render(<ConversionBar id="n" title="Briefing" actions={<button type="button">Go</button>} trigger={{ immediate: true }} />);
    screen.getByRole("button", { name: "Go" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Briefing")).toBeNull();
  });

  it("waits for the cookie consent card to leave before appearing", async () => {
    const card = document.createElement("div");
    card.className = "sm-cookie-banner-wrapper";
    document.body.appendChild(card);
    render(<ConversionBar id="n" title="Briefing" trigger={{ immediate: true }} />);
    expect(screen.queryByText("Briefing")).toBeNull();
    await act(async () => { card.remove(); await Promise.resolve(); });
    expect(screen.getByText("Briefing")).toBeTruthy();
  });

  it("a confirmation hash shows the thank-you strip, clears the hash and records the conversion", () => {
    window.history.replaceState(null, "", "/news/a-story#newsletter-confirmed");
    const onConfirm = vi.fn();
    render(<ConversionBar id="n" title="Briefing" confirmHash="newsletter-confirmed" confirmation="You're in." onConfirm={onConfirm} />);
    expect(screen.getByRole("status").textContent).toContain("You're in.");
    expect(window.location.hash).toBe("");
    expect(readConversionBarState("n").convertedAt).toBeTypeOf("number");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("actions reach the bar through useConversionBar", () => {
    function Done() {
      const bar = useConversionBar();
      return <button type="button" onClick={bar.converted}>Subscribe</button>;
    }
    render(<ConversionBar id="n" title="Briefing" actions={<Done />} trigger={{ immediate: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(screen.queryByText("Briefing")).toBeNull();
    expect(readConversionBarState("n").convertedAt).toBeTypeOf("number");
  });

  it("the details toggle expands and reports it", () => {
    const onExpand = vi.fn();
    render(<ConversionBar id="n" title="Briefing" details={<p>Weekly, free.</p>} onExpand={onExpand} trigger={{ immediate: true }} />);
    const toggle = screen.getByRole("button", { name: "More options" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Fewer options" }).getAttribute("aria-expanded")).toBe("true");
    expect(onExpand).toHaveBeenCalledWith(true);
    expect(screen.getByText("Weekly, free.")).toBeTruthy();
  });

  it("publishes its height for other fixed elements and removes it when hidden", () => {
    render(<ConversionBar id="n" title="Briefing" trigger={{ immediate: true }} />);
    expect(document.documentElement.style.getPropertyValue("--sm-conversion-bar-height")).toMatch(/px$/);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(document.documentElement.style.getPropertyValue("--sm-conversion-bar-height")).toBe("");
  });

  it("works without storage (private mode)", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
    try {
      render(<ConversionBar id="n" title="Briefing" trigger={{ immediate: true }} />);
      expect(screen.getByText("Briefing")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(screen.queryByText("Briefing")).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
