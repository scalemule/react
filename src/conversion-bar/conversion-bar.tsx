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
  /** Hide for this page view only. */
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
  /** Days a dismissal keeps the bar away. Default 14; 0 means a dismissal lasts only this page view. */
  dismissDays?: number;
  /** URL fragment (without `#`) that marks a completed conversion on arrival. */
  confirmHash?: string;
  /** What to show when the confirmation hash is seen. */
  confirmation?: ReactNode;
  /** How long the confirmation strip stays. Default 7000. */
  confirmationMs?: number;
  /** Do not appear while this selector matches (another fixed card). Default `.sm-cookie-banner-wrapper`; null disables. */
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
  const target = trigger.target ? document.querySelector(trigger.target) : null;
  if (target) {
    const rect = target.getBoundingClientRect();
    if (rect.height <= 0) return false;
    const read = (window.innerHeight - rect.top) / rect.height;
    return read >= (trigger.targetFraction ?? 0.35);
  }
  const heights = trigger.viewportHeights ?? 1.2;
  return window.scrollY >= window.innerHeight * heights;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

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
  const [phase, setPhase] = useState<ConversionBarPhase>("idle");
  const [expanded, setExpandedState] = useState(false);
  const barRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const detailsId = useId();
  const callbacks = useRef({ onView, onDismiss, onExpand, onConfirm, suppressWhen });
  callbacks.current = { onView, onDismiss, onExpand, onConfirm, suppressWhen };
  const resolvedTrigger = useMemo(() => trigger ?? {}, [trigger]);
  const currentPath = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const excluded = pathExcluded(currentPath, excludePaths);

  const hide = useCallback(() => setPhase("hidden"), []);
  const dismiss = useCallback(() => {
    if (dismissDays > 0) markConversionBarDismissed(id);
    setPhase("hidden");
    callbacks.current.onDismiss?.();
  }, [dismissDays, id]);
  const converted = useCallback(() => {
    markConversionBarConverted(id);
    setPhase("hidden");
  }, [id]);
  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
    callbacks.current.onExpand?.(next);
  }, []);

  // Decide, arm and show. Re-runs on navigation so a bar armed on one page does not pop on an excluded one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (confirmHash && window.location.hash === "#" + confirmHash) {
      markConversionBarConverted(id);
      try { window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); } catch { /* hash stays; harmless */ }
      setPhase("confirmed");
      callbacks.current.onConfirm?.();
      const timer = window.setTimeout(() => setPhase("hidden"), confirmationMs);
      return () => window.clearTimeout(timer);
    }
    if (suppressed || excluded) { setPhase("hidden"); return; }
    if (phase === "visible" || phase === "hidden") return;
    if (conversionBarSuppressedByState(readConversionBarState(id), dismissDays)) { setPhase("hidden"); return; }
    try { if (callbacks.current.suppressWhen?.()) { setPhase("hidden"); return; } } catch { /* treat as not suppressed */ }

    let cancelled = false;
    let timer = 0;
    let observer: MutationObserver | null = null;
    const show = () => {
      if (cancelled) return;
      setPhase("visible");
      callbacks.current.onView?.();
    };
    const whenClear = () => {
      if (cancelled) return;
      if (waitForSelector && document.querySelector(waitForSelector)) {
        observer = new MutationObserver(() => {
          if (!document.querySelector(waitForSelector)) { observer?.disconnect(); observer = null; whenClear(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return;
      }
      const delay = resolvedTrigger.delayMs ?? 0;
      if (delay > 0) timer = window.setTimeout(show, delay);
      else show();
    };
    const check = () => {
      if (cancelled) return;
      if (intentReached(resolvedTrigger)) {
        window.removeEventListener("scroll", check);
        window.removeEventListener("resize", check);
        whenClear();
      }
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    check();
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.clearTimeout(timer);
      observer?.disconnect();
    };
    // `phase` is read, not a dependency: the effect must not re-arm when it hides itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentPath, suppressed, excluded, dismissDays, confirmHash, confirmationMs, waitForSelector, resolvedTrigger]);

  // Publish the bar's height so other fixed elements can sit above it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const bar = barRef.current;
    if (!bar || (phase !== "visible" && phase !== "confirmed")) { root.style.removeProperty(heightVar); return; }
    const measure = () => root.style.setProperty(heightVar, `${Math.round(bar.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    return () => { observer?.disconnect(); root.style.removeProperty(heightVar); };
  }, [phase, expanded, heightVar]);

  // Escape closes the bar when focus is inside it.
  useEffect(() => {
    if (phase !== "visible") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && barRef.current?.contains(document.activeElement)) dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, dismiss]);

  const api = useMemo<ConversionBarApi>(() => ({ phase, expanded, setExpanded, dismiss, converted, hide }), [phase, expanded, setExpanded, dismiss, converted, hide]);

  if (phase === "idle" || phase === "hidden") return null;

  const motion = reducedMotion() ? "none" : "rise";

  if (phase === "confirmed") {
    return (
      <aside
        ref={barRef}
        className={`sm-conversion-bar sm-conversion-bar--confirmed ${className}`.trim()}
        style={style}
        role="status"
        aria-live="polite"
        data-phase="confirmed"
        data-motion={motion}
      >
        <div className="sm-conversion-bar__inner">
          <div className="sm-conversion-bar__lead">
            {brand && <div className="sm-conversion-bar__brand">{brand}</div>}
            <div className="sm-conversion-bar__copy">
              <p className="sm-conversion-bar__title">{confirmation ?? "Thank you. You're all set."}</p>
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
