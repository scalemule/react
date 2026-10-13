"use client";
import { useEffect, useRef, useState } from "react";
import { startMediaCapture, type MediaCaptureSession } from "@scalemule/sdk";
import { mediaAccept } from "./submission-media";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Please try again.";
export function CaptureButtons({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const photo = useRef<HTMLInputElement>(null),
    library = useRef<HTMLInputElement>(null),
    videoFile = useRef<HTMLInputElement>(null);
  const session = useRef<MediaCaptureSession>();
  const request = useRef<AbortController>();
  const preview = useRef<HTMLVideoElement>(null);
  const [recording, setRecording] = useState<"video" | "audio" | null>(null),
    [starting, setStarting] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      request.current?.abort();
      session.current?.cancel();
    },
    [],
  );
  async function record(kind: "video" | "audio") {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStarting(true);
    setError("");
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const capture = await startMediaCapture(kind, controller.signal);
      if (controller.signal.aborted) {
        capture.cancel();
        return;
      }
      session.current = capture;
      setRecording(kind);
      setElapsed(0);
      setStarting(false);
      const started = Date.now();
      timer = setInterval(
        () => setElapsed(Math.floor((Date.now() - started) / 1000)),
        250,
      );
      const file = await capture.result;
      if (file && !controller.signal.aborted) onFiles([file]);
    } catch (e) {
      if (!controller.signal.aborted) setError(message(e));
    } finally {
      clearInterval(timer);
      if (request.current === controller) {
        request.current = undefined;
        session.current = undefined;
        if (!controller.signal.aborted) {
          setRecording(null);
          setStarting(false);
        }
      }
    }
  }
  useEffect(() => {
    const element = preview.current;
    if (recording && element && session.current) {
      element.srcObject = session.current.stream;
      void element.play().catch(() => {});
    }
    return () => {
      if (element) element.srcObject = null;
    };
  }, [recording]);
  function selected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (files.length) onFiles(files);
  }
  function cancelRequest() {
    request.current?.abort();
    session.current?.cancel();
    request.current = undefined;
    session.current = undefined;
    setStarting(false);
    setRecording(null);
  }
  return (
    <div className="smcm-capture-controls">
      <div className="smcm-capture-actions">
        <button
          type="button"
          className="smcm-camera"
          disabled={disabled || starting || !!recording}
          onClick={() => photo.current?.click()}
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M8 5 9.5 3h5L16 5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          Take photo
        </button>
        <button
          type="button"
          disabled={disabled || starting || !!recording}
          onClick={() => library.current?.click()}
        >
          Choose photos / files
        </button>
      </div>
      <input
        ref={photo}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={selected}
        aria-label="Take a photo with the rear camera"
      />
      <input
        ref={library}
        type="file"
        accept={mediaAccept}
        multiple
        hidden
        onChange={selected}
        aria-label="Choose multiple photos, video or audio"
      />
      <input
        ref={videoFile}
        type="file"
        accept="video/*"
        capture="environment"
        hidden
        onChange={selected}
        aria-label="Use the phone video camera"
      />
      <details className="smcm-capture-more">
        <summary>Add video or a voice note</summary>
        <div className="smcm-capture-secondary">
          <button
            type="button"
            disabled={disabled || starting || !!recording}
            onClick={() => void record("video")}
          >
            15-second video
          </button>
          <button
            type="button"
            disabled={disabled || starting || !!recording}
            onClick={() => void record("audio")}
          >
            Voice note
          </button>
          <button
            type="button"
            disabled={disabled || starting || !!recording}
            onClick={() => videoFile.current?.click()}
          >
            Phone video camera
          </button>
        </div>
        {starting && (
          <div>
            <p role="status">Waiting for camera or microphone permission…</p>
            <button type="button" onClick={cancelRequest}>
              Cancel recording request
            </button>
          </div>
        )}
        {recording && (
          <div className="smcm-recorder">
            {recording === "video" && (
              <video ref={preview} muted playsInline autoPlay />
            )}
            <p role="status">
              Recording {elapsed}s / {recording === "video" ? 15 : 60}s
            </p>
            <button type="button" onClick={() => session.current?.stop()}>
              Stop and add
            </button>
            <button type="button" onClick={() => session.current?.cancel()}>
              Discard recording
            </button>
          </div>
        )}
        {error && (
          <p role="alert">
            {error} You can still choose files from your phone.
          </p>
        )}
      </details>
    </div>
  );
}
