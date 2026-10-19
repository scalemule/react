"use client";
import { useEffect, useRef, useState } from "react";
import {
  prepareCommunityMapAttachment,
  type CommunityMapCollection,
} from "@scalemule/sdk";
import type { CommunityMapsClient } from "./client";
import {
  CaptureDraftStore,
  type CaptureDraft,
  type CaptureFile,
} from "./capture-draft";
import { PublicationPermission } from "./submission-media";
import { CommunityMySubmissions } from "./my-submissions";
import { communitySubmissionsOpen } from "./season";
import { CaptureButtons } from "./capture-controls";
import { CommunitySubmissionForm } from "./components";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Please try again.";

interface StreetCaptureProps {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  initialAreaId?: string;
  featureHref?: (id: string) => string;
  guidelinesHref?: string;
  termsHref?: string;
}
/** A closed season keeps its contributor history without opening the camera or draft store. */
export function CommunityStreetCapture(props: StreetCaptureProps) {
  if (!communitySubmissionsOpen(props.collection))
    return (
      <div className="smcm-capture-layout">
        <p>
          New submissions are closed for this guide. Your earlier contributions
          remain below.
        </p>
        <CommunityMySubmissions {...props} />
      </div>
    );
  return <OpenStreetCapture {...props} />;
}

/** A street is selected once. Only one file is processed/uploaded at a time. */
function OpenStreetCapture({
  client,
  collection,
  initialAreaId,
  featureHref,
  guidelinesHref,
  termsHref,
}: StreetCaptureProps) {
  const store = useRef<CaptureDraftStore>();
  const current = useRef<CaptureDraft>();
  const committed = useRef<CaptureDraft>();
  const storageFailed = useRef(false);
  const writes = useRef(Promise.resolve());
  const adding = useRef(Promise.resolve());
  const upload = useRef<AbortController>();
  const alive = useRef(true);
  const busyRef = useRef(false);
  const [draft, setDraft] = useState<CaptureDraft>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [persistent, setPersistent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ id: "", percent: 0 });
  const [refresh, setRefresh] = useState(0);
  const [reload, setReload] = useState(0);
  const [detailsOnly, setDetailsOnly] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [storageError, setStorageError] = useState("");
  const policy = collection.submission_policy;
  const pending = draft?.files.length || 0;
  useEffect(() => {
    alive.current = true;
    storageFailed.current = false;
    writes.current = Promise.resolve();
    setStorageError("");
    setDraft(undefined);
    const db = new CaptureDraftStore();
    store.current = db;
    let closed = false;
    const controller = new AbortController();
    async function load() {
      if (!client.ownSubmissions)
        throw new Error(
          "This application needs the latest Community Maps client.",
        );
      const reader = await client.ownSubmissions(
        collection.slug,
        undefined,
        controller.signal,
      );
      const saved = await db.open();
      const key = `${collection.slug}:${reader.reader_key}`;
      const old = await db.load(key);
      const value = old || {
        key,
        updated: Date.now(),
        revision: 0,
        area: initialAreaId || collection.areas[0]?.id || "",
        location: "",
        category: collection.config.categories[0]?.key || "",
        title: "",
        description: "",
        hours: "",
        caption: "",
        attribution: "",
        files: [],
      };
      if (closed) {
        db.close();
        return;
      }
      current.current = value;
      committed.current = value;
      setDraft(value);
      setPersistent(saved);
      if (old?.files.length)
        setStatus(
          "Your unfinished photo queue is ready. Review permission, then resume sending.",
        );
    }
    void load().catch((e) => {
      if (!closed) setError(message(e));
    });
    return () => {
      closed = true;
      alive.current = false;
      controller.abort();
      upload.current?.abort();
      void writes.current.then(
        () => db.close(),
        () => db.close(),
      );
    };
  }, [
    client,
    collection.slug,
    collection.areas,
    collection.config.categories,
    initialAreaId,
    reload,
  ]);
  useEffect(() => {
    if (!pending) return;
    const before = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [pending]);
  const draftReady = !!draft;
  useEffect(() => {
    if (draftReady && window.location.hash === "#my-submissions")
      document
        .getElementById("my-submissions")
        ?.scrollIntoView({ block: "start" });
  }, [draftReady]);
  function change(
    update: (d: CaptureDraft) => CaptureDraft,
    add?: { id: string; file: File },
    remove?: string,
  ) {
    if (storageFailed.current)
      return Promise.reject(
        new Error("Reload your saved queue before continuing."),
      );
    const value = {
      ...update(current.current!),
      updated: Date.now(),
      revision: (current.current!.revision || 0) + 1,
    };
    current.current = value;
    if (alive.current) setDraft(value);
    // A failed transaction must not hide files or advance a receipt. Stop writes
    // until reload: another tab may own a newer revision of this private queue.
    const saved = writes.current.then(async () => {
      try {
        await store.current!.save(value, add, remove);
        committed.current = value;
      } catch (e) {
        storageFailed.current = true;
        current.current = committed.current;
        if (alive.current) {
          setDraft(committed.current);
          setStorageError(message(e));
        }
        throw e;
      }
    });
    writes.current = saved;
    return saved;
  }
  function field(
    key:
      | "area"
      | "location"
      | "category"
      | "title"
      | "description"
      | "hours"
      | "caption"
      | "attribution",
    value: string,
  ) {
    void change((d) => ({ ...d, [key]: value })).catch(() =>
      setError(
        "This device could not save your changes. Free some storage, then try again.",
      ),
    );
  }
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  function readCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = {
          latitude: Math.round(coords.latitude * 1e6) / 1e6,
          longitude: Math.round(coords.longitude * 1e6) / 1e6,
          accuracy: Math.round(coords.accuracy),
        };
        void change((d) => ({ ...d, position })).catch(() =>
          setLocationError("This device could not save your location."),
        );
        setLocating(false);
      },
      () => {
        setLocationError(
          "We could not read your location. The street you typed is still sent.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  function add(files: File[]) {
    if (storageFailed.current) return;
    setPreparing(true);
    setError("");
    adding.current = adding.current
      .catch(() => {})
      .then(async () => {
        for (const original of files) {
          if (!alive.current) return;
          const d = current.current!;
          if (d.files.length >= 30)
            throw new Error(
              "Send the 30 photos already queued before adding more.",
            );
          const file = await prepareCommunityMapAttachment(original);
          if (!alive.current) return;
          if (
            current.current!.files.reduce((sum, f) => sum + f.size, 0) +
              file.size >
            75 * 1024 * 1024
          )
            throw new Error(
              "Send the files already queued before adding more. The queue is limited to 75 MiB.",
            );
          const id = crypto.randomUUID();
          await change(
            (d) => ({
              ...d,
              files: [
                ...d.files,
                { id, name: file.name, size: file.size, type: file.type },
              ],
            }),
            { id, file },
          );
        }
      })
      .catch((e) => {
        if (alive.current) setError(message(e));
      })
      .finally(() => {
        if (alive.current) setPreparing(false);
      });
  }
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || storageFailed.current || !policy || !current.current)
      return;
    if (new FormData(event.currentTarget).get("rights") !== "on") {
      setError("Agree to publication permission before sending.");
      return;
    }
    if (!current.current.location.trim()) {
      setError("Add the street or nearest intersection first.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    const controller = new AbortController();
    upload.current = controller;
    let sent = 0;
    try {
      await adding.current;
      await writes.current;
      // A fresh identity check prevents uploading another account's restored local queue.
      const reader = await client.ownSubmissions!(
        collection.slug,
        undefined,
        controller.signal,
      );
      if (`${collection.slug}:${reader.reader_key}` !== current.current.key)
        throw new Error("Your reader session changed. Reload before sending.");
      while (current.current.files.length) {
        controller.signal.throwIfAborted();
        let d = current.current;
        if (!d.batch || d.batch.count >= 10) {
          await change((v) => ({
            ...v,
            batch: {
              count: 0,
              input: {
                area_id: v.area,
                idempotency_key: crypto.randomUUID(),
                consent: { version: policy.version, accepted: true },
                proposal: {
                  title:
                    v.title.trim() ||
                    Array.from(v.location.trim()).slice(0, 191).join(""),
                  description: v.description.trim(),
                  location_text: v.location.trim(),
                  category: v.category,
                  contributor_claim: "visitor",
                  hours: v.hours.trim() || null,
                  exact_geometry: v.position
                    ? {
                        type: "Point",
                        coordinates: [v.position.longitude, v.position.latitude],
                      }
                    : null,
                },
              },
            },
          }));
          d = current.current!;
        }
        if (!d.batch!.id) {
          if (d.batch!.input.consent.version !== policy.version)
            throw new Error(
              "Publication permission changed. Start a new street batch before sending.",
            );
          const receipt = await client.submit(collection.slug, d.batch!.input);
          await change((v) => ({
            ...v,
            batch: { ...v.batch!, id: receipt.id },
          }));
        }
        const item = current.current!.files[0];
        if (!item.upload)
          await change((v) => ({
            ...v,
            files: v.files.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    upload: {
                      submission: v.batch!.id!,
                      caption: v.caption,
                      attribution: v.attribution,
                      consent_version: policy.version,
                    },
                  }
                : f,
            ),
          }));
        const saved = current.current!.files[0];
        const file = await store.current!.file(current.current!.key, saved.id);
        if (!file)
          throw new Error(
            `${saved.name} is no longer stored on this device. Remove it and select it again.`,
          );
        setProgress({ id: saved.id, percent: 0 });
        await client.upload(
          collection.slug,
          saved.upload!.submission,
          file,
          {
            ...saved.upload!,
            rights_confirmed: true,
            idempotency_key: saved.id,
          },
          {
            signal: controller.signal,
            onProgress: (percent) => {
              if (alive.current) setProgress({ id: saved.id, percent });
            },
          },
        );
        await change(
          (v) => ({
            ...v,
            files: v.files.filter((f) => f.id !== saved.id),
            batch: { ...v.batch!, count: v.batch!.count + 1 },
          }),
          undefined,
          saved.id,
        );
        sent++;
        if (alive.current)
          setStatus(
            `${sent} attachment${sent === 1 ? "" : "s"} received for review. Keep adding photos on this street.`,
          );
      }
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof DOMException && e.name === "AbortError"
            ? "Sending paused. Resume when you’re ready."
            : message(e),
        );
    } finally {
      busyRef.current = false;
      if (alive.current) {
        setBusy(false);
        setProgress({ id: "", percent: 0 });
        setRefresh((v) => v + 1);
      }
    }
  }
  async function nextStreet() {
    if (pending || busy || preparing) return;
    await change((v) => ({
      ...v,
      location: "",
      title: "",
      description: "",
      hours: "",
      caption: "",
      position: null,
      batch: undefined,
    }));
    setStatus("");
  }
  return (
    <div className="smcm-capture-layout">
      <nav className="smcm-capture-nav" aria-label="Contributions">
        <a href="#share-street">Share a street</a>
        <a href="#my-submissions">My submissions</a>
      </nav>
      <section id="share-street" className="smcm-capture">
        <header className="smcm-capture-heading">
          <h1>See it. Snap it. Share your street.</h1>
          <p>
            Choose the street once, then keep taking photos as you walk. Add
            descriptions and visiting hours later.
          </p>
        </header>
        {storageError && (
          <div className="smcm-capture-recovery" role="alert">
            <p>{storageError}</p>
            <p>
              Sending is paused. Your last saved queue is shown below. Reload it
              before adding or sending more files; you may need to reselect the
              last photo.
            </p>
            <button
              type="button"
              disabled={busy || preparing}
              onClick={() => {
                setError("");
                setStatus("");
                setReload((v) => v + 1);
              }}
            >
              Reload saved queue
            </button>
          </div>
        )}
        {!draft ? (
          <>
            <p role="status">{error || "Opening your private photo queue…"}</p>
            {error && (
              <button
                onClick={() => {
                  setError("");
                  setReload((v) => v + 1);
                }}
              >
                Try again
              </button>
            )}
          </>
        ) : (
          <form className="smcm-form" onSubmit={send}>
            <fieldset className="smcm-capture-fields" disabled={!!storageError}>
              <div className="smcm-form-grid">
                <label>
                  Community
                  <select
                    value={draft.area}
                    disabled={!!draft.batch}
                    onChange={(e) => field("area", e.target.value)}
                  >
                    {collection.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Street or nearest intersection
                  <input
                    autoComplete="off"
                    required
                    maxLength={1000}
                    value={draft.location}
                    readOnly={!!draft.batch}
                    onChange={(e) => field("location", e.target.value)}
                  />
                </label>
              </div>
              <p className="smcm-help">
                No house number needed. Editors choose the public street or
                neighborhood after review.
              </p>
              <div className="smcm-current-location">
                <button
                  type="button"
                  className="smcm-button smcm-button-quiet"
                  disabled={busy || locating || !!draft.batch}
                  onClick={readCurrentLocation}
                >
                  {locating
                    ? "Reading your location…"
                    : draft.position
                      ? "Update my current location"
                      : "Use my current location"}
                </button>
                {draft.position && (
                  <span role="status" className="smcm-current-location-value">
                    Location attached ({draft.position.latitude.toFixed(5)},{" "}
                    {draft.position.longitude.toFixed(5)}, about{" "}
                    {draft.position.accuracy} m).{" "}
                    {!draft.batch && (
                      <button
                        type="button"
                        className="smcm-link"
                        disabled={busy}
                        onClick={() =>
                          void change((d) => ({ ...d, position: null })).catch(() =>
                            setLocationError("This device could not save your changes."),
                          )
                        }
                      >
                        Remove
                      </button>
                    )}
                  </span>
                )}
                {locationError && (
                  <span role="alert" className="smcm-help">
                    {locationError}
                  </span>
                )}
              </div>
              <p className="smcm-help">
                Standing at the display? Attaching your location pins it for
                editors. It stays private, like the street you typed.
              </p>
              <CaptureButtons
                onFiles={add}
                disabled={preparing || pending >= 30}
              />
              <p role="status" className="smcm-help">
                {preparing
                  ? "Preparing photos, one at a time…"
                  : persistent
                    ? "Unsent files are saved on this device for up to 7 days. Keep this page open while sending; return here to resume after an interruption."
                    : "This browser cannot save a queue after closing. Keep this page open until sending finishes."}
              </p>
              {pending > 0 && (
                <ul
                  className="smcm-capture-queue"
                  aria-label="Photos and recordings waiting to send"
                >
                  {draft.files.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="smcm-preview-button"
                        onClick={() => setPreview(f.id)}
                        aria-label={`Preview ${f.name}`}
                      >
                        Preview
                      </button>
                      <span className="smcm-queue-file">
                        {f.name}
                        <small>{(f.size / 1024 / 1024).toFixed(1)} MiB</small>
                      </span>
                      {progress.id === f.id ? (
                        <span role="status">
                          <progress
                            aria-label={`Uploading ${f.name}`}
                            max={100}
                            value={progress.percent}
                          />
                          {progress.percent === 99
                            ? "Processing…"
                            : `${progress.percent}%`}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || preparing}
                          onClick={() =>
                            void change(
                              (d) => ({
                                ...d,
                                files: d.files.filter((v) => v.id !== f.id),
                              }),
                              undefined,
                              f.id,
                            ).catch(() =>
                              setError(
                                "Could not remove this file. Try again.",
                              ),
                            )
                          }
                          aria-label={`Remove ${f.name}`}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {preview && draft.files.some((f) => f.id === preview) && (
                <CapturePreview
                  file={draft.files.find((f) => f.id === preview)!}
                  draftKey={draft.key}
                  store={store.current!}
                  onClose={() => setPreview(undefined)}
                />
              )}
              <details className="smcm-capture-details">
                <summary>Add details now (optional)</summary>
                <fieldset disabled={!!draft.batch}>
                  <label>
                    Category
                    <select
                      value={draft.category}
                      onChange={(e) => field("category", e.target.value)}
                    >
                      {collection.config.categories.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Name of place or display
                    <input
                      maxLength={191}
                      value={draft.title}
                      onChange={(e) => field("title", e.target.value)}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      maxLength={12000}
                      value={draft.description}
                      onChange={(e) => field("description", e.target.value)}
                    />
                  </label>
                  <label>
                    Dates and visiting hours
                    <input
                      maxLength={1000}
                      value={draft.hours}
                      onChange={(e) => field("hours", e.target.value)}
                    />
                  </label>
                </fieldset>
                <label>
                  Caption for new attachments
                  <textarea
                    maxLength={1000}
                    value={draft.caption}
                    disabled={busy}
                    onChange={(e) => field("caption", e.target.value)}
                  />
                </label>
                <label>
                  Public credit (optional)
                  <input
                    maxLength={500}
                    value={draft.attribution}
                    disabled={busy}
                    onChange={(e) => field("attribution", e.target.value)}
                  />
                </label>
              </details>
              {policy && (
                <PublicationPermission
                  policy={policy}
                  guidelinesHref={guidelinesHref}
                  termsHref={termsHref}
                />
              )}
              {status && (
                <p role="status">
                  {status} Nothing is published automatically.
                </p>
              )}
              {error && !storageError && <p role="alert">{error}</p>}
              <div
                className="smcm-capture-send"
                data-pending={pending > 0 || busy ? "true" : "false"}
              >
                {busy ? (
                  <button type="button" onClick={() => upload.current?.abort()}>
                    Pause sending
                  </button>
                ) : (
                  <button disabled={!pending || preparing || locating || !policy}>
                    {locating
                      ? "Reading your location…"
                      : `Send ${pending || "photos"} for review`}
                  </button>
                )}
                <span>{pending} waiting</span>
              </div>
              {draft.batch && (
                <button
                  type="button"
                  disabled={!!pending || busy || preparing}
                  onClick={() =>
                    void nextStreet().catch((e) => setError(message(e)))
                  }
                >
                  Next street
                </button>
              )}
            </fieldset>
          </form>
        )}
      </section>
      <p>
        <button
          type="button"
          onClick={() => setDetailsOnly((v) => !v)}
          aria-expanded={detailsOnly}
        >
          Share a place without photos
        </button>
      </p>
      {detailsOnly && (
        <CommunitySubmissionForm
          client={client}
          collection={collection}
          initialAreaId={initialAreaId}
          guidelinesHref={guidelinesHref}
          termsHref={termsHref}
        />
      )}
      {draft && (
        <CommunityMySubmissions
          client={client}
          collection={collection}
          refresh={refresh}
          featureHref={featureHref}
          guidelinesHref={guidelinesHref}
          termsHref={termsHref}
        />
      )}
    </div>
  );
}

function CapturePreview({
  file,
  draftKey,
  store,
  onClose,
}: {
  file: CaptureFile;
  draftKey: string;
  store: CaptureDraftStore;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let closed = false,
      objectUrl = "";
    setUrl("");
    void store
      .file(draftKey, file.id)
      .then((blob) => {
        if (blob && !closed) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => setUrl(""));
    return () => {
      closed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [store, draftKey, file.id]);
  return (
    <div
      className="smcm-capture-preview"
      role="region"
      aria-label="Attachment preview"
    >
      <button type="button" onClick={onClose}>
        Close preview
      </button>
      {url ? (
        file.type.startsWith("image/") ? (
          <img src={url} alt="Your photo waiting to send" />
        ) : file.type.startsWith("video/") ? (
          <video src={url} playsInline controls preload="metadata" />
        ) : (
          <audio src={url} controls preload="metadata" />
        )
      ) : (
        <p>Loading preview…</p>
      )}
    </div>
  );
}
