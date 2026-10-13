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
vi.mock("@scalemule/sdk", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@scalemule/sdk")),
  prepareCommunityMapAttachment: async (file: File) => file,
}));
afterEach(cleanup);
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
  return {
    ownSubmissions: vi.fn(async () => ({
      reader_key: "test-reader",
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
