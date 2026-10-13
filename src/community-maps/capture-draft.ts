import type { CommunityMapSubmissionInput } from "@scalemule/sdk";
export interface CaptureFile {
  id: string;
  name: string;
  size: number;
  type: string;
  upload?: {
    submission: string;
    caption: string;
    attribution: string;
    consent_version: string;
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
  files: CaptureFile[];
  batch?: { input: CommunityMapSubmissionInput; id?: string; count: number };
}
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
/** Photos stay in IndexedDB only until sent/discarded. Never store credentials here. */
export class CaptureDraftStore {
  private db?: IDBDatabase;
  private memory = new Map<string, File>();
  async open() {
    if (typeof indexedDB === "undefined") return false;
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("sm_community_capture_v1", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("drafts", { keyPath: "key" });
          request.result.createObjectStore("files");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Draft storage is blocked"));
      });
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
    if (!this.db) return undefined;
    return read(this.db.transaction("drafts").objectStore("drafts").get(key));
  }
  async save(
    draft: CaptureDraft,
    add?: { id: string; file: File },
    remove?: string,
  ) {
    if (!this.db) {
      if (add) this.memory.set(`${draft.key}:${add.id}`, add.file);
      if (remove) this.memory.delete(`${draft.key}:${remove}`);
      return;
    }
    const tx = this.db.transaction(["drafts", "files"], "readwrite");
    const previous = tx.objectStore("drafts").get(draft.key);
    previous.onsuccess = () => {
      if ((previous.result?.revision || 0) !== draft.revision - 1) {
        tx.abort();
        return;
      }
      tx.objectStore("drafts").put({ ...draft, updated: Date.now() });
      if (add) tx.objectStore("files").put(add.file, `${draft.key}:${add.id}`);
      if (remove) tx.objectStore("files").delete(`${draft.key}:${remove}`);
    };
    try {
      await complete(tx);
    } catch {
      throw new Error(
        "Your saved queue changed or device storage is full. Reload before continuing.",
      );
    }
  }
  async file(key: string, id: string): Promise<File | undefined> {
    if (!this.db) return this.memory.get(`${key}:${id}`);
    return read(
      this.db.transaction("files").objectStore("files").get(`${key}:${id}`),
    );
  }
  close() {
    this.db?.close();
    this.db = undefined;
    this.memory.clear();
  }
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
