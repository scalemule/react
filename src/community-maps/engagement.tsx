"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DiscussionThread } from "@scalemule/discussions/react";
import type {
  CommunityMapCollection,
  CommunityMapComment,
  CommunityMapVote,
} from "@scalemule/sdk";
import type { CommunityMapsClient } from "./client";
import { PublicationPermission } from "./submission-media";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "Please try again.";
export function CommunityVote({
  client,
  slug,
  featureId,
  signInHref,
  compact = false,
}: {
  client: CommunityMapsClient;
  slug: string;
  featureId: string;
  signInHref?: string;
  compact?: boolean;
}) {
  const [vote, setVote] = useState<CommunityMapVote>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    setVote(undefined);
    setError("");
    client
      .getVote?.(slug, featureId, abort.signal)
      .then((v) => {
        if (!abort.signal.aborted) setVote(v);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(message(e));
      });
    return () => abort.abort();
  }, [client, slug, featureId, retry]);
  async function cast(value: -1 | 1) {
    if (!vote?.can_vote || !client.vote || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      setVote(
        await client.vote(slug, featureId, vote.value === value ? 0 : value),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!client.getVote || !client.vote) return null;
  return (
    <div className={`smcm-voting${compact ? " smcm-voting-compact" : ""}`}>
      <div
        className="smcm-vote-controls"
        role="group"
        aria-label="Rate this place"
        aria-busy={busy}
      >
        <button
          type="button"
          aria-label={vote?.value === 1 ? "Remove upvote" : "Upvote"}
          aria-pressed={vote?.value === 1}
          disabled={!vote?.can_vote || busy}
          onClick={() => void cast(1)}
          className="smcm-vote-up"
        >
          <span aria-hidden="true">↑</span>
        </button>
        <output aria-live="polite" aria-label="Community score">
          {vote ? vote.score : "—"}
        </output>
        <button
          type="button"
          aria-label={vote?.value === -1 ? "Remove downvote" : "Downvote"}
          aria-pressed={vote?.value === -1}
          disabled={!vote?.can_vote || busy}
          onClick={() => void cast(-1)}
          className="smcm-vote-down"
        >
          <span aria-hidden="true">↓</span>
        </button>
      </div>
      <div className="smcm-vote-description">
        {!compact && (
          <span>
            {vote
              ? `${vote.up_count} up · ${vote.down_count} down`
              : "Loading votes…"}
          </span>
        )}
        {vote &&
          !vote.can_vote &&
          (signInHref ? (
            <a href={signInHref}>Sign in to vote</a>
          ) : (
            <span>Sign in to vote</span>
          ))}
        {vote?.can_vote && !compact && (
          <small>One vote per reader. Click your vote again to clear it.</small>
        )}
      </div>
      {error && (
        <div role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export function CommunityDiscussion({
  client,
  collection,
  featureId,
  title = "Community conversation",
  guidelinesHref,
  termsHref,
}: {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  featureId?: string;
  title?: string;
  guidelinesHref?: string;
  termsHref?: string;
}) {
  const [comments, setComments] = useState<CommunityMapComment[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [reply, setReply] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(false);
  const enabled =
    collection.config.comments_enabled && !!client.comments && !!client.comment;
  useEffect(() => {
    const abort = new AbortController();
    setComments([]);
    setReply(undefined);
    setNotice("");
    setError("");
    setNextPage(null);
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    client.comments!(collection.slug, featureId, 1, abort.signal)
      .then((page) => {
        if (!abort.signal.aborted) {
          setComments(page.items);
          setNextPage(page.next_page);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [client, collection.slug, featureId, enabled, retry]);
  if (!enabled) return null;
  async function more() {
    if (!nextPage || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const page = await client.comments!(collection.slug, featureId, nextPage);
      setComments((old) => [
        ...old,
        ...page.items.filter((c) => !old.some((p) => p.id === c.id)),
      ]);
      setNextPage(page.next_page);
    } catch (e) {
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !collection.submission_policy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("rights") !== "on") {
      setError("Agree to publication permission before commenting.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await client.comment!(
        collection.slug,
        {
          body: String(data.get("body") || "").trim(),
          author_name: String(data.get("author_name") || "").trim(),
          parent_comment_id: reply,
          consent: {
            version: collection.submission_policy.version,
            accepted: true,
          },
        },
        featureId,
      );
      form.reset();
      setReply(undefined);
      setNotice(
        "Your comment was sent to the editors. It will appear after review and approval.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="smcm-discussion" aria-label={title}>
      <p className="smcm-help">
        Share decoration tips, questions and experiences. Keep exact home
        addresses and personal details out. All comments are reviewed before
        publication.
      </p>
      {loading ? (
        <p role="status">Loading comments…</p>
      ) : (
        <DiscussionThread
          title={title}
          comments={comments}
          emptyMessage="No published comments yet. Share a tip or ask a question about the guide."
          theme={{
            primary: "var(--smcm-accent, #9a3b10)",
            fontFamily: "inherit",
            headingFontFamily: "inherit",
          }}
          onReply={(id) => {
            setReply(id);
            setNotice("");
            textarea.current?.focus();
          }}
        />
      )}
      {nextPage && (
        <button type="button" disabled={busy} onClick={() => void more()}>
          Load more comments
        </button>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          {!comments.length && (
            <button type="button" onClick={() => setRetry((v) => v + 1)}>
              Reload comments
            </button>
          )}
        </p>
      )}
      {notice && (
        <p role="status" className="smcm-comment-notice">
          {notice}
        </p>
      )}
      {collection.submission_policy && (
        <form className="smcm-form" onSubmit={submit} aria-busy={busy}>
          <h3>{reply ? "Write a reply" : "Join the conversation"}</h3>
          {reply && (
            <p>
              Replying to{" "}
              {comments.find((c) => c.id === reply)?.author_name || "a reader"}.{" "}
              <button type="button" onClick={() => setReply(undefined)}>
                Cancel reply
              </button>
            </p>
          )}
          <label>
            Public display name
            <input
              name="author_name"
              required
              maxLength={80}
              autoComplete="nickname"
              disabled={busy}
            />
          </label>
          <label>
            Your comment
            <textarea
              ref={textarea}
              name="body"
              required
              maxLength={2000}
              rows={4}
              disabled={busy}
            />
          </label>
          <PublicationPermission
            policy={collection.submission_policy}
            guidelinesHref={guidelinesHref}
            termsHref={termsHref}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Submit for review"}
          </button>
        </form>
      )}
    </section>
  );
}
