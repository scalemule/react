import type { CommunityMapDevicePosition } from "@scalemule/sdk";

export type DevicePositionMethod = "camera" | "at-display";
/**
 * Where the reader's device was, read with `navigator.geolocation`. `camera`
 * means it was read as the photo was taken in this form; `at-display` means the
 * reader confirmed they were standing at the display. Private, editorial-only:
 * the public guide shows only the street or block editors approve.
 */
export interface DevicePosition {
  latitude: number;
  longitude: number;
  /** Radius the device reported, in metres. */
  accuracy: number;
  /** RFC 3339, when the device read the position. */
  read_at: string;
  method: DevicePositionMethod;
}
/** Older saved drafts kept a position without its provenance. */
export type SavedPosition = Partial<
  Pick<DevicePosition, "read_at" | "method">
> &
  Omit<DevicePosition, "read_at" | "method">;

export class DevicePositionUnavailable extends Error {
  constructor(public readonly reason: "unsupported" | "denied" | "failed") {
    super(reason);
  }
}
/** Rounds to 1e-6 (about 10 cm); never resolves to 0,0. */
export function readDevicePosition(
  method: DevicePositionMethod,
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: method === "camera" ? 0 : 60000,
  },
): Promise<DevicePosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return Promise.reject(new DevicePositionUnavailable("unsupported"));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Math.round(coords.latitude * 1e6) / 1e6;
        const longitude = Math.round(coords.longitude * 1e6) / 1e6;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          (latitude === 0 && longitude === 0)
        ) {
          reject(new DevicePositionUnavailable("failed"));
          return;
        }
        resolve({
          latitude,
          longitude,
          accuracy: Math.max(0, Math.round(coords.accuracy || 0)),
          read_at: new Date().toISOString(),
          method,
        });
      },
      (error) =>
        reject(
          new DevicePositionUnavailable(
            error && error.code === 1 ? "denied" : "failed",
          ),
        ),
      options,
    );
  });
}
/** The upload field; a saved position without provenance is sent as the reader's confirmed location at the time the draft was saved. */
export function toUploadPosition(
  position: SavedPosition | null | undefined,
  fallback?: { read_at: string; method: DevicePositionMethod },
): CommunityMapDevicePosition | null {
  if (!position) return null;
  const read_at = position.read_at || fallback?.read_at;
  const method = position.method || fallback?.method;
  if (!read_at || !method) return null;
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy_m: position.accuracy,
    read_at,
    method,
  };
}
