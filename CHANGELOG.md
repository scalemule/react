## 0.0.28

- Community Maps capture works in Safari Private Browsing and in-app browsers: photo bytes are queued as plain data instead of `File` objects (which WebKit refuses to store there), and when a device refuses storage altogether the queue keeps working in the open page instead of locking the form behind "Reload saved queue".
- Dropped connections, timeouts and temporary server errors are resent automatically (three resends with backoff, same idempotency key) before the reader sees anything. Failures that remain say plainly that the photo is still saved, what to do, and the reference the publication can look up.
- Failed sends, failed loads and refused device storage are reported to the publication (`client.diagnose`, `POST …/collections/{slug}/diagnostics`) with status, reference, attempts, file type/size and a coarse browser family — never photos, text, contact details or coordinates.
- `CommunityRequestError` carries `status`, `retryable`, `reference` and `code`; `CaptureQueueConflict` now only means another tab saved a newer queue.

## 0.0.21

- Keep contributor history and media accessible when a collection stops accepting submissions.
- Respect collection end dates in capture, submission and editing controls; preserve browser draft storage.
- Seasonal publishing schedules remain application configuration. This patch does not add collection lifecycle automation or change backend access rules.

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

