/**
 * Per-browser memory of a conversion bar: when the reader dismissed it and
 * whether they converted. Zero PII; the key carries only the bar's id.
 */
export interface ConversionBarState {
  /** Epoch milliseconds of the last dismissal. */
  dismissedAt?: number;
  /** Epoch milliseconds of the conversion (sign-up, purchase, confirmation). */
  convertedAt?: number;
}

export const CONVERSION_BAR_STORAGE_PREFIX = "sm_conversion_bar:";

export function conversionBarStorageKey(id: string): string {
  return CONVERSION_BAR_STORAGE_PREFIX + id;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readConversionBarState(id: string): ConversionBarState {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(conversionBarStorageKey(id));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const state: ConversionBarState = {};
    if (typeof parsed.dismissedAt === "number" && Number.isFinite(parsed.dismissedAt)) state.dismissedAt = parsed.dismissedAt;
    if (typeof parsed.convertedAt === "number" && Number.isFinite(parsed.convertedAt)) state.convertedAt = parsed.convertedAt;
    return state;
  } catch {
    return {};
  }
}

function writeConversionBarState(id: string, state: ConversionBarState): void {
  const store = storage();
  if (!store) return;
  try {
    if (!state.dismissedAt && !state.convertedAt) store.removeItem(conversionBarStorageKey(id));
    else store.setItem(conversionBarStorageKey(id), JSON.stringify(state));
  } catch {
    /* private mode or blocked storage: the bar simply shows again next time */
  }
}

export function markConversionBarDismissed(id: string, now = Date.now()): void {
  writeConversionBarState(id, { ...readConversionBarState(id), dismissedAt: now });
}

export function markConversionBarConverted(id: string, now = Date.now()): void {
  writeConversionBarState(id, { ...readConversionBarState(id), convertedAt: now });
}

export function clearConversionBarState(id: string): void {
  writeConversionBarState(id, {});
}

/** True while a dismissal or a conversion should keep the bar away. */
export function conversionBarSuppressedByState(state: ConversionBarState, dismissDays: number, now = Date.now()): boolean {
  if (state.convertedAt) return true;
  if (state.dismissedAt && dismissDays > 0 && now - state.dismissedAt < dismissDays * 86_400_000) return true;
  return false;
}
