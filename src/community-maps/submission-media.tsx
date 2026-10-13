"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  prepareCommunityMapAttachment,
  type CommunityMapSubmissionPolicy,
} from "@scalemule/sdk";
import type { CommunityMapsClient } from "./client";
import { CaptureButtons } from "./capture-controls";
export const mediaAccept =
  "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/webm,.m4a,.mov";
export function validateCommunityMedia(files: File[]) {
  if (files.length > 10) throw new Error("Choose up to 10 attachments.");
  for (const file of files) {
    const photo = file.type.startsWith("image/");
    if (!file.size || file.size > (photo ? 8 : 25) * 1024 * 1024)
      throw new Error(
        `${file.name}: choose a ${photo ? "photo up to 8 MiB" : "video or audio file up to 25 MiB"}.`,
      );
  }
}
export function PublicationPermission({
  policy,
  guidelinesHref,
  termsHref,
}: {
  policy: CommunityMapSubmissionPolicy;
  guidelinesHref?: string;
  termsHref?: string;
}) {
  return (
    <fieldset className="smcm-permission">
      <legend>Publication permission</legend>
      <p>{policy.text}</p>
      <details>
        <summary>Contribution guidelines</summary>
        <p>{policy.guidelines}</p>
        {guidelinesHref && (
          <a href={guidelinesHref} target="_blank" rel="noreferrer">
            Publication editorial standards
          </a>
        )}
        {termsHref && (
          <>
            {" "}
            ·{" "}
            <a href={termsHref} target="_blank" rel="noreferrer">
              Reader terms
            </a>
          </>
        )}
      </details>
      <label className="smcm-check">
        <input name="rights" type="checkbox" required /> I have read and agree
        to this publication permission and the contribution guidelines.
      </label>
    </fieldset>
  );
}
export function CommunityMediaFields({
  required = false,
  onFiles,
  caption = "",
  attribution = "",
  hidePicker = false,
}: {
  hidePicker?: boolean;
  required?: boolean;
  caption?: string;
  attribution?: string;
  onFiles: (files: File[]) => void;
}) {
  return (
    <fieldset className="smcm-media-fields">
      <legend>Photos, video or audio {required ? "" : "(optional)"}</legend>
      {!hidePicker && (
        <label>
          Choose attachments
          <input
            name="attachments"
            type="file"
            multiple
            accept={mediaAccept}
            required={required}
            onChange={(e) => onFiles(Array.from(e.currentTarget.files || []))}
          />
        </label>
      )}
      <p className="smcm-help">
        Up to 10 files. Photos: JPEG, PNG or WebP, up to 8 MiB each. Video:
        H.264 MP4/MOV or WebM, up to 3 minutes. Audio: MP3, M4A, WAV or Ogg, up
        to 10 minutes. Video and audio: up to 25 MiB each.
      </p>
      <label>
        Caption or description for these attachments
        <textarea name="caption" maxLength={1000} defaultValue={caption} />
      </label>
      <label>
        Public credit for these attachments (optional)
        <input name="attribution" maxLength={500} defaultValue={attribution} />
      </label>
      <p className="smcm-help">
        Every attachment is reviewed before publication. Embedded location
        metadata is removed; editors also check the visible and audible content
        for privacy and guideline concerns.
      </p>
    </fieldset>
  );
}
export function CommunityMediaSubmission({
  client,
  slug,
  submission,
  policy,
  initialFiles = [],
  initialCaption = "",
  initialAttribution = "",
  initialMessage = "",
  guidelinesHref,
  termsHref,
  maxFiles = 10,
  onReceived,
}: {
  maxFiles?: number;
  onReceived?: () => void;
  client: CommunityMapsClient;
  slug: string;
  submission: string;
  policy: CommunityMapSubmissionPolicy;
  initialFiles?: File[];
  initialCaption?: string;
  initialAttribution?: string;
  initialMessage?: string;
  guidelinesHref?: string;
  termsHref?: string;
}) {
  const [files, setFiles] = useState(initialFiles);
  const keys = useRef(new WeakMap<File, string>());
  const [preparing, setPreparing] = useState(false);
  async function add(selected: File[]) {
    setPreparing(true);
    setError("");
    try {
      if (files.length + selected.length > maxFiles)
        throw new Error(`Choose up to ${maxFiles} attachments.`);
      const prepared: File[] = [];
      for (const file of selected)
        prepared.push(await prepareCommunityMapAttachment(file));
      if (
        [...files, ...prepared].reduce((size, f) => size + f.size, 0) >
        75 * 1024 * 1024
      )
        throw new Error(
          "Send these files before adding more. The queue is limited to 75 MiB.",
        );
      setFiles((v) => [...v, ...prepared]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare media.");
    } finally {
      setPreparing(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialMessage);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setStatus("");
    let received = 0;
    try {
      validateCommunityMedia(files);
      if (files.length > maxFiles)
        throw new Error(`Choose up to ${maxFiles} more attachments.`);
      if (!files.length) throw new Error("Choose a file to attach.");
      for (const file of files) {
        if (!keys.current.has(file))
          keys.current.set(file, crypto.randomUUID());
        await client.upload(slug, submission, file, {
          idempotency_key: keys.current.get(file),
          caption: String(data.get("caption") || ""),
          attribution: String(data.get("attribution") || ""),
          rights_confirmed: data.get("rights") === "on",
          consent_version: policy.version,
        });
        received++;
        setFiles(files.slice(received));
      }
      onReceived?.();
      form.reset();
      setStatus(
        `${received} attachment${received === 1 ? "" : "s"} received for editorial review.`,
      );
    } catch (e) {
      setError(
        `${received ? `${received} attachment(s) received. ` : ""}${e instanceof Error ? e.message : "Upload interrupted. Please retry the remaining files."}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="smcm-form" onSubmit={submit}>
      <h3>
        {files.length
          ? "Finish attaching your media"
          : "Add optional photos, video or audio"}
      </h3>
      <fieldset disabled={busy || preparing}>
        <CaptureButtons
          disabled={busy || preparing}
          onFiles={(selected) => void add(selected)}
        />
        <CommunityMediaFields
          hidePicker
          onFiles={setFiles}
          caption={initialCaption}
          attribution={initialAttribution}
        />
        {files.length > 0 && (
          <ul aria-label="Attachments waiting to upload">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                {f.name}{" "}
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {initialFiles.length > 0 && (
          <p className="smcm-help">
            Your place was already received. Retry only the remaining
            attachments.
          </p>
        )}
        <PublicationPermission
          policy={policy}
          guidelinesHref={guidelinesHref}
          termsHref={termsHref}
        />
        <button disabled={!files.length}>
          {busy ? "Uploading…" : "Send attachments for review"}
        </button>
      </fieldset>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
