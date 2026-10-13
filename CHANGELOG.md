## 0.0.17

- Add street-first mobile capture with native rear camera, multi-select library, bounded video/voice capture, and one-at-a-time preparation/uploads.
- Persist a reader-scoped, bounded queue in IndexedDB for up to seven days; remove sent bytes, detect stale tabs, expose progress/pause/retry, and reuse stable attachment receipts. Explicitly disclose the fallback when local persistence is unavailable.
- Add private contributor history, detail updates, attachment previews, and links to public voting/comments after approval. Support more than ten photos by sending bounded batches for the same street.
- Keep optional descriptions and the existing text-only contribution path. Browser-closed background transfer and HEIC conversion are not included.

