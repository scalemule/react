## 0.0.20

- Support community terminology, source-specific boundary descriptions and visitor information in illustrated atlases. Existing city snapshots remain compatible.
- Clear selected landmarks and streets when the active community changes; replace Walnut Creek-specific footer attribution with the configured geographic sources.
- Publishers still supply verified geographic reference snapshots; geographic data ingestion is not automatic.

## 0.0.19

- Simplify mobile capture with prominent photo actions and optional video/audio/details disclosures; preserve explicit publication permission and moderation.
- Recover safely from failed local queue writes, support cancelling pending camera requests, and bound stalled API calls without automatic mutation retries.
- Improve guide touch controls, page scrolling, contrast and failed-load recovery. MapLibre and city geography remain lazy, outside the capture screen.
- Physical-device camera verification, HEIC conversion and browser-closed background uploads remain separate.

## 0.0.18

- Correct capture-button specificity and send-bar contrast for light/dark host themes. The send bar becomes sticky only after photos are queued, keeping the initial camera action visible on phones.
- Preserve all 0.0.17 capture, privacy and moderation behavior; physical-device capture verification remains separate.

## 0.0.17

- Add street-first mobile capture with native rear camera, multi-select library, bounded video/voice capture, and one-at-a-time preparation/uploads.
- Persist a reader-scoped, bounded queue in IndexedDB for up to seven days; remove sent bytes, detect stale tabs, expose progress/pause/retry, and reuse stable attachment receipts. Explicitly disclose the fallback when local persistence is unavailable.
- Add private contributor history, detail updates, attachment previews, and links to public voting/comments after approval. Support more than ten photos by sending bounded batches for the same street.
- Keep optional descriptions and the existing text-only contribution path. Browser-closed background transfer and HEIC conversion are not included.

