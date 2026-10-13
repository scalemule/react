import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { startMediaCapture, type MediaCaptureSession } from "@scalemule/sdk";
import { CaptureButtons } from "./capture-controls";
vi.mock("@scalemule/sdk", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@scalemule/sdk")),
  startMediaCapture: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("camera permission recovery", () => {
  it("cancels an unanswered permission request and ignores its late completion", async () => {
    let finish: (session: MediaCaptureSession) => void = () => {};
    vi.mocked(startMediaCapture)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    render(<CaptureButtons onFiles={vi.fn()} />);
    fireEvent.click(screen.getByText("Add video or a voice note"));
    fireEvent.click(screen.getByRole("button", { name: "15-second video" }));
    const firstSignal = vi.mocked(startMediaCapture).mock.calls[0][1];
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel recording request" }),
    );
    expect(firstSignal?.aborted).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Take photo" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Voice note" }));
    expect(startMediaCapture).toHaveBeenCalledTimes(2);
    const cancel = vi.fn();
    finish({
      cancel,
      stop: vi.fn(),
      stream: {} as MediaStream,
      result: Promise.resolve(null),
    });
    await waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    // A late response from the cancelled request cannot dismiss the new request.
    expect(
      screen.getByRole("button", { name: "Cancel recording request" }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Take photo" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
