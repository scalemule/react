import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import type { CommunityMapsClient } from "./client";
import type { CommunityMapCollection } from "@scalemule/sdk";
import { CommunityStreetCapture } from "./capture";
import { CaptureDraftStore } from "./capture-draft";
import { indexedDB } from "fake-indexeddb";
vi.mock("@scalemule/sdk", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@scalemule/sdk")),
  prepareCommunityMapAttachment: async (file: File) => file,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const collection = {
  slug: "gardens",
  submission_policy: {
    version: "policy",
    text: "Permission",
    guidelines: "Guidelines",
  },
  areas: [{ id: "area", name: "София" }],
  config: {
    submissions_open: true,
    categories: [{ key: "street", label: "Street" }],
  },
} as CommunityMapCollection;
function client() {
  const reader = crypto.randomUUID();
  return {
    ownSubmissions: vi.fn(async () => ({
      reader_key: reader,
      items: [],
      next_cursor: null,
    })),
    submit: vi.fn(async () => ({ id: "submission", received: true })),
    upload: vi.fn(async () => ({ id: "media" })),
  } as unknown as CommunityMapsClient;
}
async function setup(c: CommunityMapsClient) {
  render(<CommunityStreetCapture client={c} collection={collection} />);
  await screen.findByLabelText("Street or nearest intersection");
  fireEvent.change(screen.getByLabelText("Street or nearest intersection"), {
    target: { value: "Улица 🎃" },
  });
}
const photos = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => new File(["photo"], `photo-${i}.jpg`, { type: "image/jpeg" }),
  );
async function choose(n: number) {
  fireEvent.change(
    screen.getByLabelText("Choose multiple photos, video or audio"),
    { target: { files: photos(n) } },
  );
  await screen.findByText(`${n} waiting`);
}
function send() {
  const button = screen.getByRole("button", { name: /Send .* for review/ });
  fireEvent.submit(button.closest("form")!);
}
describe("street capture", () => {
  it("keeps a received photo visible if saving its receipt fails and safely resumes after reload", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: indexedDB,
      configurable: true,
    });
    const save = CaptureDraftStore.prototype.save;
    let fail = true;
    vi.spyOn(CaptureDraftStore.prototype, "save").mockImplementation(
      async function (this: CaptureDraftStore, ...args) {
        if (args[2] && fail) {
          fail = false;
          throw new Error("Device storage is full. Reload before continuing.");
        }
        return save.apply(this, args);
      },
    );
    const c = client();
    await setup(c);
    await choose(1);
    fireEvent.click(screen.getByRole("checkbox"));
    send();
    await screen.findByRole("button", { name: "Reload saved queue" });
    expect(screen.getByText("1 waiting")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Send 1 for review" })
        .closest("fieldset")?.disabled,
    ).toBe(true);
    expect(c.upload).toHaveBeenCalledTimes(1);
    const retryKey = vi.mocked(c.upload).mock.calls[0][3].idempotency_key;
    fireEvent.click(screen.getByRole("button", { name: "Reload saved queue" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Reload saved queue" }),
      ).toBeNull(),
    );
    await screen.findByLabelText("Street or nearest intersection");
    await screen.findByText("1 waiting");
    fireEvent.click(screen.getByRole("checkbox"));
    send();
    await waitFor(() => expect(c.upload).toHaveBeenCalledTimes(2));
    await screen.findByText("0 waiting");
    expect(vi.mocked(c.upload).mock.calls[1][3].idempotency_key).toBe(retryKey);
    expect(c.submit).toHaveBeenCalledTimes(1);
  });
  it("appends repeated camera picks, requires permission, and sends street context without a description", async () => {
    const c = client();
    await setup(c);
    await choose(2);
    fireEvent.change(
      screen.getByLabelText("Take a photo with the rear camera"),
      { target: { files: photos(1) } },
    );
    await screen.findByText("3 waiting");
    send();
    await screen.findByRole("alert");
    expect(c.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    send();
    await waitFor(() => expect(c.upload).toHaveBeenCalledTimes(3));
    expect(vi.mocked(c.submit).mock.calls[0][1].proposal).toMatchObject({
      title: "Улица 🎃",
      description: "",
      location_text: "Улица 🎃",
    });
    expect(c.submit).toHaveBeenCalledTimes(1);
  });
  it("reads the device position as a camera photo is taken and sends it with that photo only", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: {
          latitude: 38.0011204,
          longitude: -122.0321617,
          accuracy: 12.4,
        },
      } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });
    const c = client();
    vi.mocked(c.upload).mockResolvedValue({
      id: "media",
      position_captured: false,
    });
    await setup(c);
    await choose(1);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByLabelText("Take a photo with the rear camera"),
      { target: { files: photos(1) } },
    );
    await screen.findByText("2 waiting");
    await screen.findByText(/Location read for this photo \(about 12 m\)/);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("checkbox"));
    send();
    await waitFor(() => expect(c.upload).toHaveBeenCalledTimes(2));
    const fields = vi.mocked(c.upload).mock.calls.map((call) => call[3]);
    const library = fields.find((f) => !f.device_position);
    const camera = fields.find((f) => f.device_position);
    expect(library).toBeDefined();
    expect(camera?.device_position).toMatchObject({
      latitude: 38.00112,
      longitude: -122.032162,
      accuracy_m: 12,
      method: "camera",
    });
    expect(camera?.device_position?.read_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The photo without GPS and without a device read is reported back to the reader.
    await screen.findByText(
      /1 carried no location data; editors will place it/,
    );
  });
  it("sends the reader's at-display position with library photos when they attached one", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: { latitude: 37.978, longitude: -122.0311, accuracy: 30 },
      } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });
    const c = client();
    await setup(c);
    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    await screen.findByText(/Location attached/);
    await choose(1);
    fireEvent.click(screen.getByRole("checkbox"));
    send();
    await waitFor(() => expect(c.upload).toHaveBeenCalledTimes(1));
    expect(vi.mocked(c.upload).mock.calls[0][3].device_position).toMatchObject({
      latitude: 37.978,
      longitude: -122.0311,
      accuracy_m: 30,
      method: "at-display",
    });
  });
  it("retries the same attachment key after a lost response without recreating the street", async () => {
    const c = client();
    vi.mocked(c.upload)
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValue({ id: "media" });
    await setup(c);
    await choose(1);
    fireEvent.click(screen.getByRole("checkbox"));
    send();
    await screen.findByText("Connection interrupted");
    const key = vi.mocked(c.upload).mock.calls[0][3].idempotency_key;
    send();
    await waitFor(() => expect(c.upload).toHaveBeenCalledTimes(2));
    expect(vi.mocked(c.upload).mock.calls[1][3].idempotency_key).toBe(key);
    expect(c.submit).toHaveBeenCalledTimes(1);
  });
  it("sends more than ten street photos in bounded review batches", async () => {
    const c = client();
    await setup(c);
    await choose(11);
    fireEvent.click(screen.getByRole("checkbox"));
    send();
    await waitFor(() => expect(c.upload).toHaveBeenCalledTimes(11));
    expect(c.submit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(c.submit).mock.calls[0][1].idempotency_key).not.toBe(
      vi.mocked(c.submit).mock.calls[1][1].idempotency_key,
    );
  });
});

describe("past seasons", () => {
  it.each([false, true])(
    "keeps contributor history visible when submissions are closed (expired: %s)",
    async (expired) => {
      const c = client();
      const open = vi.spyOn(CaptureDraftStore.prototype, "open");
      vi.mocked(c.ownSubmissions!).mockResolvedValue({
        reader_key: "same-reader",
        next_cursor: null,
        items: [
          {
            id: "earlier",
            revision: 1,
            status: "SUBMITTED",
            editable: true,
            area_id: "area",
            proposal: {
              title: "Светлини 🎄",
              location_text: "Street only",
              description: "Earlier contribution",
            },
            media: [],
          },
        ],
      } as Awaited<
        ReturnType<NonNullable<CommunityMapsClient["ownSubmissions"]>>
      >);
      const ended = {
        ...collection,
        config: {
          ...collection.config,
          submissions_open: expired,
          ends_at: expired ? "2020-01-01T00:00:00Z" : undefined,
        },
      };
      const { container } = render(
        <CommunityStreetCapture client={c} collection={ended} />,
      );
      await screen.findByText("Светлини 🎄");
      expect(c.ownSubmissions).toHaveBeenCalledWith(
        "gardens",
        undefined,
        expect.any(AbortSignal),
      );
      expect(
        screen.getByRole("heading", { name: "My submissions" }),
      ).toBeTruthy();
      expect(
        container.querySelector('input[type="file"], canvas, form'),
      ).toBeNull();
      expect(screen.queryByText("Share a place without photos")).toBeNull();
      expect(open).not.toHaveBeenCalled();
      expect(c.submit).not.toHaveBeenCalled();
      expect(c.upload).not.toHaveBeenCalled();
    },
  );
});
