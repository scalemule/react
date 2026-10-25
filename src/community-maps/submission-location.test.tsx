import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { CommunitySubmissionForm } from "./components";
import type { CommunityMapsClient } from "./client";
import type { CommunityMapCollection } from "@scalemule/sdk";

const collection: CommunityMapCollection = {
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
  } as unknown as CommunityMapCollection["config"],
  areas: [
    {
      id: "a1",
      name: "Concord",
      slug: "concord",
    } as unknown as CommunityMapCollection["areas"][number],
  ],
  submission_policy: {
    version: "v1",
    text: "permission",
    guidelines: "be kind",
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommunitySubmissionForm current location", () => {
  it("attaches the device position as private exact_geometry and lets the reader remove it", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: {
          latitude: 37.9780004,
          longitude: -122.0311009,
          accuracy: 12.4,
        },
      } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });
    const submit = vi.fn(async (_slug: string, _input: unknown) => ({
      id: "s1",
      status: "SUBMITTED",
    }));
    const client = {
      submit,
      upload: vi.fn(),
    } as unknown as CommunityMapsClient;
    render(<CommunitySubmissionForm client={client} collection={collection} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "37.97800, -122.03110, about 12 m",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(2));
    await screen.findByText(/Location attached/);

    fireEvent.change(screen.getByLabelText("Name of place or display"), {
      target: { value: "Happy Puppets" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Coffin and cauldron" },
    });
    fireEvent.change(screen.getByLabelText("Location for editorial review"), {
      target: { value: "near the park" },
    });
    fireEvent.click(screen.getByLabelText(/I have read and agree/));
    fireEvent.submit(
      screen.getByLabelText("Location for editorial review").closest("form")!,
    );
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const input = submit.mock.calls[0][1] as unknown as {
      proposal: { exact_geometry: unknown };
    };
    expect(input.proposal.exact_geometry).toEqual({
      type: "Point",
      coordinates: [-122.031101, 37.978],
    });
  });

  it("explains when the browser has no geolocation", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });
    const client = {
      submit: vi.fn(),
      upload: vi.fn(),
    } as unknown as CommunityMapsClient;
    render(<CommunitySubmissionForm client={client} collection={collection} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "not available",
    );
  });

  it("asks whether the reader is at the display once photos are chosen and sends the answer with each photo", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: { latitude: 38.0011204, longitude: -122.0321617, accuracy: 8 },
      } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });
    const submit = vi.fn(async () => ({ id: "s1", status: "SUBMITTED" }));
    const upload = vi.fn(async () => ({ id: "m1", position_captured: false }));
    const client = { submit, upload } as unknown as CommunityMapsClient;
    render(<CommunitySubmissionForm client={client} collection={collection} />);
    expect(screen.queryByText(/Are you at this display right now/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Choose attachments"), {
      target: { files: [new File(["x"], "porch.jpg", { type: "image/jpeg" })] },
    });
    await screen.findByText(/Are you at this display right now/);
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, pin my location" }),
    );
    await screen.findByText(/Location attached/);
    expect(screen.queryByText(/Are you at this display right now/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Name of place or display"), {
      target: { value: "Sanford & Floyd" },
    });
    fireEvent.change(screen.getByLabelText("Location for editorial review"), {
      target: { value: "Sanford St and Floyd Ln" },
    });
    fireEvent.click(screen.getByLabelText(/I have read and agree/));
    fireEvent.submit(
      screen.getByLabelText("Location for editorial review").closest("form")!,
    );
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    const fields = (upload.mock.calls[0] as unknown[])[3] as {
      device_position: unknown;
    };
    expect(fields.device_position).toMatchObject({
      latitude: 38.00112,
      longitude: -122.032162,
      accuracy_m: 8,
      method: "at-display",
    });
    // A position was attached, so no "carried no location data" warning.
    await screen.findByText(
      /1 attachment\(s\) received for editorial review\.$/,
    );
  });

  it("lets the reader say they are elsewhere and reports photos that carried no location", async () => {
    const submit = vi.fn(async () => ({ id: "s1", status: "SUBMITTED" }));
    const upload = vi.fn(async () => ({ id: "m1", position_captured: false }));
    const client = { submit, upload } as unknown as CommunityMapsClient;
    render(<CommunitySubmissionForm client={client} collection={collection} />);
    fireEvent.change(screen.getByLabelText("Choose attachments"), {
      target: { files: [new File(["x"], "porch.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "No, I’m somewhere else" }),
    );
    await screen.findByText(/Editors will place it from the street you typed/);
    fireEvent.change(screen.getByLabelText("Name of place or display"), {
      target: { value: "Sanford & Floyd" },
    });
    fireEvent.change(screen.getByLabelText("Location for editorial review"), {
      target: { value: "Sanford St and Floyd Ln" },
    });
    fireEvent.click(screen.getByLabelText(/I have read and agree/));
    fireEvent.submit(
      screen.getByLabelText("Location for editorial review").closest("form")!,
    );
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(
      ((upload.mock.calls[0] as unknown[])[3] as { device_position: unknown })
        .device_position,
    ).toBeNull();
    await screen.findByText(
      /carried no location data; editors will place the display/,
    );
  });
});
