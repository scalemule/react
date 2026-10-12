import type {
  CommunityMapsService,
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
export interface CommunityMapsClient {
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
    },
  ): Promise<{ id: string }>;
  mediaUrl(slug: string, id: string): string;
}
/** Use for already authenticated clients. Server keys belong only on your server. */
export function communityMapsSdkClient(
  service: CommunityMapsService,
  mediaUrl: CommunityMapsClient["mediaUrl"],
  options?: RequestOptions,
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
    upload: (s, id, file, fields) =>
      unwrap(service.uploadMedia(s, id, file, fields, options)),
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
    upload: (s, id, file, fields) => {
      const form = new FormData();
      form.set("file", file);
      for (const [k, v] of Object.entries(fields)) form.set(k, String(v));
      return request(
        `${path(s)}/submissions/${encodeURIComponent(id)}/media`,
        "POST",
        form,
      );
    },
    mediaUrl: (s, id) => `${path(s)}/media/${encodeURIComponent(id)}`,
  };
}
