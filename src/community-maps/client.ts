import type {
  CommunityMapsService,
  CommunityMapOwnSubmissionPage,
  CommunityMapSubmissionUpdate,
  CommunityMapVote,
  CommunityMapCommentPage,
  CommunityMapCommentInput,
  CommunityMapCollection,
  CommunityMapFeature,
  CommunityMapFeatureQuery,
  CommunityMapPage,
  CommunityMapSubmissionInput,
  CommunityMapReceipt,
  CommunityMapReportInput,
  RequestOptions,
} from "@scalemule/sdk";
export interface CommunityUploadOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}
export interface CommunityMapsClient {
  ownSubmissions?(
    slug: string,
    after?: string,
    signal?: AbortSignal,
  ): Promise<CommunityMapOwnSubmissionPage>;
  updateSubmission?(
    slug: string,
    id: string,
    input: CommunityMapSubmissionUpdate,
  ): Promise<{ id: string; revision: number }>;
  ownMediaUrl?(slug: string, submission: string, id: string): string;
  getVote?(
    slug: string,
    id: string,
    signal?: AbortSignal,
  ): Promise<CommunityMapVote>;
  vote?(slug: string, id: string, value: -1 | 0 | 1): Promise<CommunityMapVote>;
  comments?(
    slug: string,
    featureId?: string,
    page?: number,
    signal?: AbortSignal,
  ): Promise<CommunityMapCommentPage>;
  comment?(
    slug: string,
    input: CommunityMapCommentInput,
    featureId?: string,
  ): Promise<{ id: string; status: "pending" }>;
  collection(
    slug: string,
    signal?: AbortSignal,
  ): Promise<CommunityMapCollection>;
  features(
    slug: string,
    query?: CommunityMapFeatureQuery,
    signal?: AbortSignal,
  ): Promise<CommunityMapPage<CommunityMapFeature>>;
  feature(
    slug: string,
    id: string,
    signal?: AbortSignal,
  ): Promise<CommunityMapFeature>;
  submit(
    slug: string,
    input: CommunityMapSubmissionInput,
  ): Promise<CommunityMapReceipt>;
  react(
    slug: string,
    id: string,
    reaction: string,
    active: boolean,
  ): Promise<{ count: number; active: boolean }>;
  report(
    slug: string,
    id: string,
    input: CommunityMapReportInput,
  ): Promise<CommunityMapReceipt>;
  upload(
    slug: string,
    submission: string,
    file: File,
    fields: {
      caption: string;
      attribution: string;
      rights_confirmed: boolean;
      consent_version: string;
      idempotency_key?: string;
    },
    options?: CommunityUploadOptions,
  ): Promise<{ id: string }>;
  mediaUrl(slug: string, id: string): string;
}
/** Use for already authenticated clients. Server keys belong only on your server. */
export function communityMapsSdkClient(
  service: CommunityMapsService,
  mediaUrl: CommunityMapsClient["mediaUrl"],
  options?: RequestOptions,
  ownMediaUrl?: CommunityMapsClient["ownMediaUrl"],
): CommunityMapsClient {
  const unwrap = async <T>(
    result: Promise<{ data: T | null; error: { message: string } | null }>,
  ) => {
    const r = await result;
    if (r.error || !r.data)
      throw new Error(r.error?.message || "Community guide unavailable");
    return r.data;
  };
  return {
    ownMediaUrl,
    ownSubmissions: (s, after, signal) =>
      unwrap(service.listOwnSubmissions(s, after, { ...options, signal })),
    updateSubmission: (s, id, input) =>
      unwrap(service.updateOwnSubmission(s, id, input, options)),
    getVote: (s, id, signal) =>
      unwrap(service.getVote(s, id, { ...options, signal })),
    vote: (s, id, value) => unwrap(service.vote(s, id, value, options)),
    comments: (s, feature_id, page, signal) =>
      unwrap(
        service.listComments(s, { feature_id, page }, { ...options, signal }),
      ),
    comment: (s, input, featureId) =>
      unwrap(service.createComment(s, input, featureId, options)),
    collection: (s, signal) =>
      unwrap(service.getCollection(s, { ...options, signal })),
    features: (s, q, signal) =>
      unwrap(service.listFeatures(s, q, { ...options, signal })),
    feature: (s, id, signal) =>
      unwrap(service.getFeature(s, id, { ...options, signal })),
    submit: (s, d) => unwrap(service.createSubmission(s, d, options)),
    react: (s, id, r, a) => unwrap(service.react(s, id, r, a, options)),
    report: (s, id, d) => unwrap(service.report(s, id, d, options)),
    upload: (s, id, file, fields, uploadOptions) =>
      unwrap(
        service.uploadMedia(s, id, file, fields, {
          ...options,
          signal: uploadOptions?.signal,
        }),
      ),
    mediaUrl,
  };
}
/** Same-origin application proxy. It resolves the publication and reader on the server. */
export function createCommunityMapsBrowserClient(
  basePath = "/api/community-maps",
): CommunityMapsClient {
  if (
    !basePath.startsWith("/") ||
    basePath.startsWith("//") ||
    basePath.includes("\\") ||
    basePath.includes("?") ||
    basePath.includes("#")
  )
    throw new Error("Use a same-origin API path");
  const path = (s: string) =>
    `${basePath}/collections/${encodeURIComponent(s)}`;
  async function request<T>(
    url: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    const response = await fetch(url, {
      method,
      signal,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body && !form ? { "Content-Type": "application/json" } : undefined,
      body: form ? body : body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.error)
      throw new Error(
        result?.error?.message ||
          "The community guide is unavailable. Please try again.",
      );
    return result.data as T;
  }
  const commentsPath = (s: string, featureId?: string, page?: number) => {
    const query = new URLSearchParams();
    if (featureId) query.set("feature_id", featureId);
    if (page) query.set("page", String(page));
    return `${path(s)}/comments?${query}`;
  };
  return {
    ownSubmissions: (s, after, signal) =>
      request(
        `${path(s)}/submissions${after ? `?after=${encodeURIComponent(after)}` : ""}`,
        "GET",
        undefined,
        signal,
      ),
    updateSubmission: (s, id, input) =>
      request(
        `${path(s)}/submissions/${encodeURIComponent(id)}`,
        "POST",
        input,
      ),
    ownMediaUrl: (s, id, media) =>
      `${path(s)}/submissions/${encodeURIComponent(id)}/media/${encodeURIComponent(media)}`,
    getVote: (s, id, signal) =>
      request(
        `${path(s)}/features/${encodeURIComponent(id)}/vote`,
        "GET",
        undefined,
        signal,
      ),
    vote: (s, id, value) =>
      request(`${path(s)}/features/${encodeURIComponent(id)}/vote`, "POST", {
        value,
      }),
    comments: (s, featureId, page, signal) =>
      request(commentsPath(s, featureId, page), "GET", undefined, signal),
    comment: (s, input, featureId) =>
      request(commentsPath(s, featureId), "POST", input),
    collection: (s, signal) => request(path(s), "GET", undefined, signal),
    features: (s, q = {}, signal) => {
      const query = new URLSearchParams();
      for (const [k, v] of Object.entries(q))
        if (v !== undefined) query.set(k, String(v));
      return request(`${path(s)}/features?${query}`, "GET", undefined, signal);
    },
    feature: (s, id, signal) =>
      request(
        `${path(s)}/features/${encodeURIComponent(id)}`,
        "GET",
        undefined,
        signal,
      ),
    submit: (s, input) => request(`${path(s)}/submissions`, "POST", input),
    react: (s, id, reaction, active) =>
      request(
        `${path(s)}/features/${encodeURIComponent(id)}/reactions`,
        "POST",
        { reaction, active },
      ),
    report: (s, id, input) =>
      request(
        `${path(s)}/features/${encodeURIComponent(id)}/reports`,
        "POST",
        input,
      ),
    upload: (s, id, file, fields, options) => {
      const form = new FormData();
      form.set("file", file);
      for (const [k, v] of Object.entries(fields)) form.set(k, String(v));
      return new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        const clean = () =>
          options?.signal?.removeEventListener("abort", abort);
        if (options?.signal?.aborted) {
          reject(new DOMException("Upload paused", "AbortError"));
          return;
        }
        xhr.open(
          "POST",
          `${path(s)}/submissions/${encodeURIComponent(id)}/media`,
        );
        xhr.withCredentials = true;
        xhr.timeout = 180000;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            options?.onProgress?.(
              Math.min(99, Math.round((e.loaded / e.total) * 100)),
            );
        };
        xhr.onload = () => {
          clean();
          let result;
          try {
            result = JSON.parse(xhr.responseText);
          } catch {
            reject(
              new Error("Upload response was interrupted. Retry this file."),
            );
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300 && result.data?.id) {
            options?.onProgress?.(100);
            resolve(result.data);
          } else
            reject(
              new Error(
                result?.error?.message || "Upload failed. Retry this file.",
              ),
            );
        };
        xhr.onerror = () => {
          clean();
          reject(
            new Error("Connection interrupted. Your queue is ready to retry."),
          );
        };
        xhr.ontimeout = () => {
          clean();
          reject(
            new Error(
              "Upload timed out. Retry when you have a stronger connection.",
            ),
          );
        };
        xhr.onabort = () => {
          clean();
          reject(new DOMException("Upload paused", "AbortError"));
        };
        options?.signal?.addEventListener("abort", abort, { once: true });
        xhr.send(form);
      });
    },
    mediaUrl: (s, id) => `${path(s)}/media/${encodeURIComponent(id)}`,
  };
}
