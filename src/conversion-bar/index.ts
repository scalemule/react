/**
 * ConversionBar: a reusable, intent-driven bottom bar for any ScaleMule app
 * (newsletter sign-ups, trials, supporter plans). Import the styles from
 * `@scalemule/react/conversion-bar.css`.
 */
export { ConversionBar, useConversionBar } from "./conversion-bar";
export type { ConversionBarApi, ConversionBarPhase, ConversionBarProps, ConversionBarTrigger } from "./conversion-bar";
export {
  CONVERSION_BAR_STORAGE_PREFIX,
  clearConversionBarState,
  conversionBarStorageKey,
  conversionBarSuppressedByState,
  markConversionBarConverted,
  markConversionBarDismissed,
  readConversionBarState,
} from "./storage";
export type { ConversionBarState } from "./storage";
