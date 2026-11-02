import type {
  CommunityMapDevicePosition,
  CommunityMapSubmissionInput,
} from "@scalemule/sdk";
import type { DevicePosition, SavedPosition } from "./device-position";
export interface CaptureFile {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Device position read as this photo was taken with the camera button. Private. */
  position?: DevicePosition | null;
  upload?: {
    submission: string;
    caption: string;
    attribution: string;
    consent_version: string;
    device_position?: CommunityMapDevicePosition | null;
  };
}
export interface CaptureDraft {
  key: string;
  updated: number;
  revision: number;
  area: string;
  location: string;
  category: string;
  title: string;
  description: string;
  hours: string;
  caption: string;
  attribution: string;
  /** Device position the reader chose to attach ("I'm at the display"); private, editorial-only. */
  position?: SavedPosition | null;
  files: CaptureFile[];
  batch?: { input: CommunityMapSubmissionInput; id?: string; count: number };
}
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
/** Another tab saved a newer revision of this reader's queue. */
export class CaptureQueueConflict extends Error {}
/**
 * Photo bytes are stored as an ArrayBuffer record, never as a File: Safari
 * Private Browsing (and in-app browsers built on it) refuses Blob/File values
 * in IndexedDB but accepts plain bytes. Older drafts may still hold a File.
 */
interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  data: ArrayBuffer;
}
/**
 * A queue the device refused to store lives here for the life of the page, so a
 * re-mounted form (new props, "Reload saved queue") still finds its photos.
 */
const pageQueue = {
  files: new Map<string, File>(),
  drafts: new Map<string, CaptureDraft>(),
};
/** Safari drops IndexedDB connections when a page is backgrounded; reconnect once. */
const lostConnection = (e: unknown) =>
  e instanceof DOMException &&
  (e.name === "InvalidStateError" || e.name === "UnknownError");
/** Photos stay in IndexedDB only until sent/discarded. Never store credentials here. */
export class CaptureDraftStore {
  private db?: IDBDatabase;
  /**
   * The device refused to save (private browsing, full storage, restricted
   * in-app browser). The queue keeps working in this page only.
   */
  memoryOnly = false;
  async open() {
    if (typeof indexedDB === "undefined") return false;
    try {
      this.db = await connect();
      this.db.onversionchange = () => this.close();
      const tx = this.db.transaction(["drafts", "files"], "readwrite");
      const cursor = tx.objectStore("drafts").openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        const draft = c.value as CaptureDraft;
        if (Date.now() - draft.updated > MAX_AGE) {
          for (const f of draft.files)
            tx.objectStore("files").delete(`${draft.key}:${f.id}`);
          c.delete();
        }
        c.continue();
      };
      await complete(tx);
      return true;
    } catch {
      this.close();
      return false;
    }
  }
  async load(key: string): Promise<CaptureDraft | undefined> {
    const kept = pageQueue.drafts.get(key);
    if (kept || !this.db) {
      if (kept) this.memoryOnly = true;
      return kept;
    }
    return this.retrying(() =>
      read(this.db!.transaction("drafts").objectStore("drafts").get(key)),
    );
  }
  /**
   * Saves the draft (and a file to add/remove) atomically. Resolves "device"
   * when stored on the device and "memory" when the device refused and the
   * queue now lives in this page. Rejects only with CaptureQueueConflict.
   */
  async save(
    draft: CaptureDraft,
    add?: { id: string; file: File },
    remove?: string,
  ): Promise<"device" | "memory"> {
    if (this.memoryOnly || !this.db) return this.remember(draft, add, remove);
    // Read the bytes first: an IndexedDB transaction commits as soon as it has
    // nothing pending, so it must never wait on a Blob read.
    let stored: StoredFile | undefined;
    if (add)
      try {
        stored = {
          name: add.file.name,
          type: add.file.type,
          lastModified: add.file.lastModified,
          data: await add.file.arrayBuffer(),
        };
      } catch {
        return this.remember(draft, add, remove);
      }
    let conflict = false;
    const write = () => {
      const tx = this.db!.transaction(["drafts", "files"], "readwrite");
      const previous = tx.objectStore("drafts").get(draft.key);
      previous.onsuccess = () => {
        if ((previous.result?.revision || 0) !== draft.revision - 1) {
          conflict = true;
          tx.abort();
          return;
        }
        tx.objectStore("drafts").put({ ...draft, updated: Date.now() });
        if (stored)
          tx.objectStore("files").put(stored, `${draft.key}:${add!.id}`);
        if (remove) tx.objectStore("files").delete(`${draft.key}:${remove}`);
      };
      return complete(tx);
    };
    try {
      await this.retrying(write);
      return "device";
    } catch {
      if (conflict)
        throw new CaptureQueueConflict(
          "Your photo queue changed in another tab. Reload before continuing.",
        );
      // Files already on the device stay readable; everything from now on is
      // kept in this page so the reader can still send.
      for (const { id } of draft.files) {
        const k = `${draft.key}:${id}`;
        if (id === remove || pageQueue.files.has(k)) continue;
        const file = await this.file(draft.key, id).catch(() => undefined);
        if (file) pageQueue.files.set(k, file);
      }
      return this.remember(draft, add, remove);
    }
  }
  async file(key: string, id: string): Promise<File | undefined> {
    const kept = pageQueue.files.get(`${key}:${id}`);
    if (kept || !this.db) return kept;
    const value = await this.retrying(() =>
      read<File | StoredFile | undefined>(
        this.db!.transaction("files").objectStore("files").get(`${key}:${id}`),
      ),
    );
    if (!value || value instanceof Blob) return value;
    return new File([value.data], value.name, {
      type: value.type,
      lastModified: value.lastModified,
    });
  }
  /** Closes the connection; a page-only queue survives for the next form. */
  close() {
    this.db?.close();
    this.db = undefined;
  }
  private async retrying<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (e) {
      if (!lostConnection(e) || typeof indexedDB === "undefined") throw e;
      this.db?.close();
      this.db = await connect();
      this.db.onversionchange = () => this.close();
      return run();
    }
  }
  private remember(
    draft: CaptureDraft,
    add?: { id: string; file: File },
    remove?: string,
  ): "memory" {
    this.memoryOnly = true;
    pageQueue.drafts.set(draft.key, draft);
    if (add) pageQueue.files.set(`${draft.key}:${add.id}`, add.file);
    if (remove) pageQueue.files.delete(`${draft.key}:${remove}`);
    // Keep the small draft record (batch receipt, which photos remain) on the
    // device when it still accepts it, so a reload resumes the same submission
    // instead of creating a second one. Bytes it refused are not retried.
    if (this.db)
      try {
        const tx = this.db.transaction(["drafts", "files"], "readwrite");
        tx.objectStore("drafts").put({ ...draft, updated: Date.now() });
        if (remove) tx.objectStore("files").delete(`${draft.key}:${remove}`);
        void complete(tx).catch(() => {});
      } catch {
        // Best effort only.
      }
    return "memory";
  }
}
function connect() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("sm_community_capture_v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts", { keyPath: "key" });
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Draft storage is blocked"));
  });
}
function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function complete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Saving the queue was interrupted"));
  });
}
