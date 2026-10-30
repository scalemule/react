"use client";
/**
 * ConversionBar: a stylish, intent-driven bottom bar that any ScaleMule app can
 * use to ask for one thing (a newsletter sign-up, a trial, a supporter plan).
 *
 * The bar is quiet by design: it appears only after the reader shows intent
 * (reading a third of an article, scrolling past the first screen), never on
 * pages the app excludes, never again for a converted reader, and not for
 * `dismissDays` after a dismissal. It waits for other fixed UI (the cookie
 * consent card by default) to go away, publishes its own height as a CSS
 * variable so chat launchers and audio players can move out of its way, and
 * recognises a confirmation hash (`#newsletter-confirmed`) so a sign-in round
 * trip can land the reader back on the page with a "you're in" strip.
 *
 * It holds no credentials and talks to no network: the app supplies the actions.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  conversionBarSuppressedByState,
  markConversionBarConverted,
  markConversionBarDismissed,
  readConversionBarState,
} from "./storage";

export interface ConversionBarTrigger {
  /** CSS selector of the element whose reading progress arms the bar, e.g. `"article"`. */
  target?: string;
  /** Fraction of the target that must be read before the bar appears. Default 0.35. */
  targetFraction?: number;
  /** Without a target on the page: viewport heights the reader must scroll. Default 1.2. */
  viewportHeights?: number;
  /** Pause between the intent signal and the bar. Default 0. */
  delayMs?: number;
  /** Viewport heights the reader must have scrolled before any trigger counts. Default 0.5. */
  minScrollViewports?: number;
  /** Show at once; the page itself is the invitation. */
  immediate?: boolean;
}

export type ConversionBarPhase = "idle" | "visible" | "confirmed" | "hidden";

export interface ConversionBarApi {
  phase: ConversionBarPhase;
  expanded: boolean;
  setExpanded(expanded: boolean): void;
  /** Hide for `dismissDays`; records the dismissal. */
  dismiss(): void;
  /** Hide for good on this browser; records the conversion. */
  converted(): void;
  /** Hide on this page; it may come back on the next client-side navigation. */
  hide(): void;
}

export interface ConversionBarProps {
  /** Stable id; namespaces browser memory (`sm_conversion_bar:<id>`). */
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** A mark or wordmark shown before the copy. */
  brand?: ReactNode;
  /** Primary actions, always visible (one button on a phone). */
  actions?: ReactNode;
  /**
   * Secondary actions: inline on wide screens; on a phone they appear once the bar is
   * expanded (the details toggle, or `useConversionBar().setExpanded(true)` from an action).
   */
  secondary?: ReactNode;
  /** Fine print under the actions (consent, terms); always visible. */
  fine?: ReactNode;
  /** Extra options behind the expand toggle. */
  details?: ReactNode;
  /** The current pathname; pass Next's `usePathname()` so client navigation is honoured. */
  pathname?: string;
  /** Server-known reasons never to show (signed-in reader, known subscriber). */
  suppressed?: boolean;
  /** Browser-side reasons never to show, evaluated at mount and on navigation. */
  suppressWhen?: () => boolean;
  /** Pathnames that never get the bar. */
  excludePaths?: RegExp[];
  trigger?: ConversionBarTrigger;
  /** Days a dismissal keeps the bar away. Default 14; 0 means a dismissal lasts only for this page. */
  dismissDays?: number;
  /** URL fragment (without `#`) that marks a completed conversion on arrival. */
  confirmHash?: string;
  /**
   * The server confirmed the conversion (for example a signed subscribed-state cookie set by the
   * sign-in callback). Without it a confirmation hash is removed and ignored, so a crafted link
   * cannot show the thank-you strip or mark the reader converted.
   */
  confirmationVerified?: boolean;
  /** What to show when the confirmation hash is seen. */
  confirmation?: ReactNode;
  /** How long the confirmation strip stays. Default 7000. */
  confirmationMs?: number;
  /** Step aside while this selector matches (another fixed card, such as cookie consent). Default `.sm-cookie-banner-wrapper`; null disables. */
  waitForSelector?: string | null;
  /** CSS custom property on `<html>` carrying the bar's height. Default `--sm-conversion-bar-height`. */
  heightVar?: string;
  dismissLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  onView?(): void;
  onDismiss?(): void;
  onExpand?(expanded: boolean): void;
  onConfirm?(): void;
  className?: string;
  style?: CSSProperties;
}

const ConversionBarContext = createContext<ConversionBarApi | null>(null);

/** Actions rendered inside a ConversionBar reach its api (dismiss, converted, expanded). */
export function useConversionBar(): ConversionBarApi {
  const api = useContext(ConversionBarContext);
  if (!api) throw new Error("useConversionBar must be used inside a ConversionBar");
  return api;
}

function pathExcluded(pathname: string, rules: RegExp[] | undefined): boolean {
  return Boolean(rules?.some(rule => rule.test(pathname)));
}

function intentReached(trigger: ConversionBarTrigger): boolean {
  if (trigger.immediate) return true;
  // Intent is scrolling, never what happens to be on screen at load.
  if (window.scrollY < window.innerHeight * (trigger.minScrollViewports ?? 0.5)) return false;
  const target = trigger.target ? document.querySelector(trigger.target) : null;
  if (target) {
    const rect = target.getBoundingClientRect();
    if (rect.height <= 0) return false;
    const read = (window.innerHeight - rect.top) / rect.height;
    return read >= (trigger.targetFraction ?? 0.35);
  }
  return window.scrollY >= window.innerHeight * (trigger.viewportHeights ?? 1.2);
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Why the bar is closed: for good in this browser session, or only on one page. */
type Closed = null | "session" | { path: string };

export function ConversionBar({
  id,
  title,
  description,
  brand,
  actions,
  secondary,
  fine,
  details,
  pathname,
  suppressed = false,
  suppressWhen,
  excludePaths,
  trigger,
  dismissDays = 14,
  confirmHash,
  confirmationVerified = false,
  confirmation,
  confirmationMs = 7000,
  waitForSelector = ".sm-cookie-banner-wrapper",
  heightVar = "--sm-conversion-bar-height",
  dismissLabel = "Dismiss",
  expandLabel = "More options",
  collapseLabel = "Fewer options",
  onView,
  onDismiss,
  onExpand,
  onConfirm,
  className = "",
  style,
}: ConversionBarProps) {
  const [phase, setPhaseState] = useState<ConversionBarPhase>("idle");
  const [expanded, setExpandedState] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const barRef = useRef<HTMLElement | null>(null);
  const phaseRef = useRef<ConversionBarPhase>("idle");
  const closedRef = useRef<Closed>(null);
  const confirmingRef = useRef(false);
  const viewedRef = useRef(false);
  const titleId = useId();
  const detailsId = useId();
  const callbacks = useRef({ onView, onDismiss, onExpand, onConfirm, suppressWhen });
  callbacks.current = { onView, onDismiss, onExpand, onConfirm, suppressWhen };
  const triggerKey = JSON.stringify(trigger ?? {});
  const resolvedTrigger = useMemo<ConversionBarTrigger>(() => JSON.parse(triggerKey), [triggerKey]);
  const currentPath = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const excluded = pathExcluded(currentPath, excludePaths);
  const pathRef = useRef(currentPath);
  pathRef.current = currentPath;

  const setPhase = useCallback((next: ConversionBarPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const hide = useCallback(() => {
    closedRef.current = { path: pathRef.current };
    setPhase("hidden");
  }, [setPhase]);
  const dismiss = useCallback(() => {
    if (dismissDays > 0) {
      markConversionBarDismissed(id);
      closedRef.current = "session";
    } else {
      closedRef.current = { path: pathRef.current };
    }
    setPhase("hidden");
    callbacks.current.onDismiss?.();
  }, [dismissDays, id, setPhase]);
  const converted = useCallback(() => {
    markConversionBarConverted(id);
    closedRef.current = "session";
    setPhase("hidden");
  }, [id, setPhase]);
  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
    callbacks.current.onExpand?.(next);
  }, []);

  // Decide, arm and show. Re-evaluated on every navigation: an exclusion or suppression only
  // lasts while it applies, while a dismissal or conversion lasts for the session.
  useEffect(() => {
    if (typeof window === "undefined" || confirmingRef.current) return;
    if (confirmHash && window.location.hash === "#" + confirmHash) {
      try { window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); } catch { /* hash stays; harmless */ }
      if (confirmationVerified) {
        confirmingRef.current = true;
        closedRef.current = "session";
        markConversionBarConverted(id);
        setPhase("confirmed");
        callbacks.current.onConfirm?.();
        return;
      }
    }
    const closed = closedRef.current;
    if (closed && closed !== "session" && closed.path !== currentPath) closedRef.current = null;
    if (closedRef.current) { setPhase("hidden"); return; }
    let quiet = suppressed || excluded || conversionBarSuppressedByState(readConversionBarState(id), dismissDays);
    if (!quiet) { try { quiet = Boolean(callbacks.current.suppressWhen?.()); } catch { /* treat as not suppressed */ } }
    if (quiet) { setPhase("hidden"); return; }
    if (phaseRef.current === "visible") return;
    setPhase("idle");

    let cancelled = false;
    let timer = 0;
    const show = () => { if (!cancelled) setPhase("visible"); };
    const check = () => {
      if (cancelled || !intentReached(resolvedTrigger)) return;
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      const delay = resolvedTrigger.delayMs ?? 0;
      if (delay > 0) timer = window.setTimeout(show, delay);
      else show();
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    check();
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.clearTimeout(timer);
    };
  }, [id, currentPath, suppressed, excluded, dismissDays, confirmHash, confirmationVerified, resolvedTrigger, setPhase]);

  // The thank-you strip leaves on its own.
  useEffect(() => {
    if (phase !== "confirmed") return;
    const timer = window.setTimeout(() => setPhase("hidden"), confirmationMs);
    const announce = window.setTimeout(() => setAnnounced(true), 60);
    return () => { window.clearTimeout(timer); window.clearTimeout(announce); };
  }, [phase, confirmationMs, setPhase]);

  // Step aside while another fixed card (cookie consent) is on screen; it may appear after the bar.
  useEffect(() => {
    if (phase !== "visible" && phase !== "confirmed") return;
    if (!waitForSelector) { setBlocked(false); return; }
    const update = () => setBlocked(Boolean(document.querySelector(waitForSelector)));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [phase, waitForSelector]);

  // A view counts once the reader can actually see the bar.
  useEffect(() => {
    if (phase === "visible" && !blocked && !viewedRef.current) {
      viewedRef.current = true;
      callbacks.current.onView?.();
    }
  }, [phase, blocked]);

  // Publish the bar's height so other fixed elements (and page padding) can make room.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const bar = barRef.current;
    if (!bar || blocked || (phase !== "visible" && phase !== "confirmed")) { root.style.removeProperty(heightVar); return; }
    const measure = () => root.style.setProperty(heightVar, `${Math.round(bar.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    return () => { observer?.disconnect(); root.style.removeProperty(heightVar); };
  }, [phase, expanded, blocked, heightVar]);

  // Escape closes the bar when focus is inside it, but never mid-composition or over typed text.
  useEffect(() => {
    if (phase !== "visible") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
      const active = document.activeElement;
      if (!active || !barRef.current?.contains(active)) return;
      if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && active.value) return;
      dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, dismiss]);

  const api = useMemo<ConversionBarApi>(() => ({ phase, expanded, setExpanded, dismiss, converted, hide }), [phase, expanded, setExpanded, dismiss, converted, hide]);

  if (phase === "idle" || phase === "hidden" || blocked) return null;

  const motion = reducedMotion() ? "none" : "rise";

  if (phase === "confirmed") {
    const text = confirmation ?? "Thank you. You're all set.";
    return (
      <aside
        ref={barRef}
        className={`sm-conversion-bar sm-conversion-bar--confirmed ${className}`.trim()}
        style={style}
        data-phase="confirmed"
        data-motion={motion}
      >
        <div className="sm-conversion-bar__inner">
          <div className="sm-conversion-bar__lead">
            {brand && <div className="sm-conversion-bar__brand">{brand}</div>}
            <div className="sm-conversion-bar__copy">
              <p className="sm-conversion-bar__title" aria-hidden="true">{text}</p>
              {/* Filled after insertion so screen readers announce it. */}
              <p className="sm-conversion-bar__sr" role="status">{announced ? text : null}</p>
            </div>
          </div>
          <button type="button" className="sm-conversion-bar__dismiss" onClick={hide} aria-label={dismissLabel}>
            <DismissMark />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <ConversionBarContext.Provider value={api}>
      <aside
        ref={barRef}
        className={`sm-conversion-bar ${className}`.trim()}
        style={style}
        role="region"
        aria-labelledby={titleId}
        data-phase="visible"
        data-expanded={expanded ? "true" : "false"}
        data-has-details={details ? "true" : "false"}
        data-motion={motion}
      >
        <div className="sm-conversion-bar__inner">
          <div className="sm-conversion-bar__lead">
            {brand && <div className="sm-conversion-bar__brand">{brand}</div>}
            <div className="sm-conversion-bar__copy">
              <p className="sm-conversion-bar__title" id={titleId}>{title}</p>
              {description && <p className="sm-conversion-bar__description">{description}</p>}
            </div>
          </div>
          {(actions || secondary || fine) && (
            <div className="sm-conversion-bar__cta">
              {(actions || secondary) && (
                <div className="sm-conversion-bar__row">
                  {actions && <div className="sm-conversion-bar__actions">{actions}</div>}
                  {secondary && <div className="sm-conversion-bar__secondary">{secondary}</div>}
                </div>
              )}
              {fine && <div className="sm-conversion-bar__fine">{fine}</div>}
            </div>
          )}
          {details && (
            <button
              type="button"
              className="sm-conversion-bar__expand"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded(!expanded)}
            >
              <span className="sm-conversion-bar__expand-label">{expanded ? collapseLabel : expandLabel}</span>
              <ChevronMark />
            </button>
          )}
          <button type="button" className="sm-conversion-bar__dismiss" onClick={dismiss} aria-label={dismissLabel}>
            <DismissMark />
          </button>
        </div>
        {details && (
          <div className="sm-conversion-bar__details" id={detailsId} hidden={!expanded}>
            {details}
          </div>
        )}
      </aside>
    </ConversionBarContext.Provider>
  );
}

function DismissMark() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function ChevronMark() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l5-5 5 5" />
    </svg>
  );
}
