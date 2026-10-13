"use client";
import { communitySubmissionsOpen } from "./season";
import { useEffect, useState, type FormEvent } from "react";
import type {
  CommunityMapCollection,
  CommunityMapOwnSubmission,
} from "@scalemule/sdk";
import type { CommunityMapsClient } from "./client";
import {
  CommunityMediaSubmission,
  PublicationPermission,
} from "./submission-media";
export function CommunityMySubmissions({
  client,
  collection,
  refresh = 0,
  featureHref,
  guidelinesHref,
  termsHref,
}: {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  refresh?: number;
  featureHref?: (id: string) => string;
  guidelinesHref?: string;
  termsHref?: string;
}) {
  const open = communitySubmissionsOpen(collection);
  const [items, setItems] = useState<CommunityMapOwnSubmission[]>([]),
    [next, setNext] = useState<string | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (client.ownSubmissions)
      void client
        .ownSubmissions(collection.slug, undefined, controller.signal)
        .then((page) => {
          if (!controller.signal.aborted) {
            setItems(page.items);
            setNext(page.next_cursor);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e instanceof Error ? e.message : "Could not load submissions.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    else setLoading(false);
    return () => controller.abort();
  }, [client, collection.slug, refresh, revision]);
  async function more() {
    if (!next || !client.ownSubmissions) return;
    setLoading(true);
    try {
      const page = await client.ownSubmissions(collection.slug, next);
      setItems((v) => [
        ...v,
        ...page.items.filter((i) => !v.some((old) => old.id === i.id)),
      ]);
      setNext(page.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section id="my-submissions" className="smcm-my-submissions">
      <h2>My submissions</h2>
      <p>
        Your contributions stay private until editorial review. Return using the
        same browser or the account you used when submitting.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => setRevision((v) => v + 1)}
      >
        Refresh submissions
      </button>
      {loading && <p role="status">Loading your submissions…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !items.length && (
        <p>
          {open
            ? "No submissions yet. Take a photo of a street you’d like to share."
            : "No contributions from this browser or account in this guide."}
        </p>
      )}
      {items.map((item) => (
        <details
          className="smcm-own-submission"
          key={`${item.id}:${item.revision}`}
        >
          <summary>
            <strong>{item.proposal.title}</strong>
            <span>
              {item.status.toLowerCase().replace(/_/g, " ")} ·{" "}
              {item.media.length} attachments
            </span>
          </summary>
          <p>{item.proposal.location_text}</p>
          {item.proposal.description && <p>{item.proposal.description}</p>}
          {!!item.media.length && (
            <div className="smcm-own-media">
              {item.media.map((media) => {
                const url = client.ownMediaUrl?.(
                  collection.slug,
                  item.id,
                  media.id,
                );
                return (
                  <figure key={media.id}>
                    {url &&
                      (media.content_type.startsWith("image/") ? (
                        <img
                          src={url}
                          loading="lazy"
                          decoding="async"
                          alt={media.caption || "Your submitted photo"}
                        />
                      ) : media.content_type.startsWith("video/") ? (
                        <video src={url} controls playsInline preload="none" />
                      ) : (
                        <audio src={url} controls preload="none" />
                      ))}
                    <figcaption>
                      {media.caption || media.content_type.split("/")[0]} —{" "}
                      {media.status.toLowerCase()}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
          {item.feature_id && featureHref && (
            <p>
              <a href={featureHref(item.feature_id)}>
                View the published place, vote and join the conversation
              </a>
            </p>
          )}
          {open && item.editable && collection.submission_policy && (
            <>
              <EditSubmission
                client={client}
                collection={collection}
                item={item}
                onSaved={() => setRevision((v) => v + 1)}
                guidelinesHref={guidelinesHref}
                termsHref={termsHref}
              />
              {item.media.length < 10 && (
                <CommunityMediaSubmission
                  client={client}
                  slug={collection.slug}
                  submission={item.id}
                  policy={collection.submission_policy}
                  guidelinesHref={guidelinesHref}
                  termsHref={termsHref}
                  maxFiles={10 - item.media.length}
                  onReceived={() => setRevision((v) => v + 1)}
                />
              )}
            </>
          )}
          {open && !item.editable && !item.feature_id && (
            <p>
              Editorial review is complete for this contribution. You can send a
              new contribution from the capture form above.
            </p>
          )}
        </details>
      ))}
      {next && (
        <button disabled={loading} type="button" onClick={() => void more()}>
          Earlier submissions
        </button>
      )}
    </section>
  );
}
function EditSubmission({
  client,
  collection,
  item,
  onSaved,
  guidelinesHref,
  termsHref,
}: {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  item: CommunityMapOwnSubmission;
  onSaved: () => void;
  guidelinesHref?: string;
  termsHref?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !client.updateSubmission || !collection.submission_policy)
      return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (data.get("rights") !== "on")
        throw new Error("Agree to publication permission before saving.");
      await client.updateSubmission(collection.slug, item.id, {
        expected_revision: item.revision,
        proposal: {
          ...item.proposal,
          title: String(data.get("title") || "").trim(),
          description: String(data.get("description") || "").trim(),
          hours: String(data.get("hours") || "").trim() || null,
        },
        consent: {
          version: collection.submission_policy.version,
          accepted: true,
        },
      });
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Add or edit details</summary>
      <form className="smcm-form" onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Name of place or display
            <input
              name="title"
              required
              maxLength={191}
              defaultValue={item.proposal.title}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              maxLength={12000}
              defaultValue={item.proposal.description}
            />
          </label>
          <label>
            Dates and visiting hours
            <input
              name="hours"
              maxLength={1000}
              defaultValue={item.proposal.hours || ""}
            />
          </label>
          <PublicationPermission
            policy={collection.submission_policy!}
            guidelinesHref={guidelinesHref}
            termsHref={termsHref}
          />
          <button>{busy ? "Saving…" : "Save details for review"}</button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
