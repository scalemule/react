## 0.0.18

- Correct capture-button specificity and send-bar contrast for light/dark host themes. The send bar becomes sticky only after photos are queued, keeping the initial camera action visible on phones.
- Preserve all 0.0.17 capture, privacy and moderation behavior; physical-device capture verification remains separate.

## 0.0.17

- Add street-first mobile capture with native rear camera, multi-select library, bounded video/voice capture, and one-at-a-time preparation/uploads.
- Persist a reader-scoped, bounded queue in IndexedDB for up to seven days; remove sent bytes, detect stale tabs, expose progress/pause/retry, and reuse stable attachment receipts. Explicitly disclose the fallback when local persistence is unavailable.
- Add private contributor history, detail updates, attachment previews, and links to public voting/comments after approval. Support more than ten photos by sending bounded batches for the same street.
- Keep optional descriptions and the existing text-only contribution path. Browser-closed background transfer and HEIC conversion are not included.

