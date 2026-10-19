/**
 * Contract: the browser never transforms a reader's photograph before upload.
 * Capture metadata (GPS, time) must reach scalemule-photo intact; only the photo
 * service may strip it, after it has kept the private record. A client-side
 * canvas re-encode or "privacy strip" here would silently destroy that data
 * and force contributors to re-upload — this test fails if it ever appears.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommunitySubmissionForm } from "./components";
import type { CommunityMapsClient } from "./client";
import type { CommunityMapCollection } from "@scalemule/sdk";

// A JPEG-looking byte pattern with a fake APP1/EXIF segment: distinctive enough
// that any transformation changes it.
const ORIGINAL = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53, 0x21,
  ...Array.from({ length: 64 }, (_, i) => (i * 37) & 0xff), 0xff, 0xd9,
]);

const collection = {
  id: "c1",
  slug: "halloween-2026",
  revision: 1,
  config: {
    title: "Halloween 2026",
    description: "",
    kind: "seasonal-guide",
    submissions_open: true,
    ends_at: null,
    starts_at: null,
    timezone: "America/Los_Angeles",
    reactions: [],
    categories: [{ key: "decorated-street", label: "Decorated street" }],
  },
  areas: [{ id: "a1", name: "Concord", slug: "concord" }],
  submission_policy: { version: "v1", text: "permission", guidelines: "be kind" },
} as unknown as CommunityMapCollection;

afterEach(() => cleanup());

describe("upload integrity", () => {
  it("sends the reader's photo bytes exactly as chosen, with no client-side re-encoding", async () => {
    const submit = vi.fn(async () => ({ id: "s1", status: "SUBMITTED" }));
    const upload = vi.fn(async () => ({ id: "m1", status: "SUBMITTED" }));
    const client = { submit, upload } as unknown as CommunityMapsClient;
    render(<CommunitySubmissionForm client={client} collection={collection} />);

    const file = new File([ORIGINAL], "display.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.change(screen.getByLabelText("Name of place or display"), { target: { value: "Happy Puppets" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Coffin and cauldron" } });
    fireEvent.change(screen.getByLabelText("Location for editorial review"), { target: { value: "near the park" } });
    fireEvent.click(screen.getByLabelText(/I have read and agree/));
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    const sent = upload.mock.calls[0][2] as Blob;
    expect(sent).toBe(file);
    const bytes = new Uint8Array(await sent.arrayBuffer());
    expect(bytes).toEqual(ORIGINAL);
    expect(sent.type).toBe("image/jpeg");
  });
});
