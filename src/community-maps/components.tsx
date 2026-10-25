"use client";
import { communitySubmissionsOpen } from "./season";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  CommunityMapArea,
  CommunityMapCollection,
  CommunityMapFeature,
  CommunityMapFeatureQuery,
  CommunityMapPage,
  CommunityMapReportReason,
  CommunityMapProposal,
} from "@scalemule/sdk";
import {
  CommunityMediaFields,
  CommunityMediaSubmission,
  PublicationPermission,
  validateCommunityMedia,
} from "./submission-media";
import type { CommunityMapSubmissionPolicy } from "@scalemule/sdk";
import type { CommunityMapsClient } from "./client";
import {
  DevicePositionUnavailable,
  readDevicePosition,
  toUploadPosition,
  type DevicePosition,
} from "./device-position";
import { CommunityMap, type CommunityMapProvider } from "./map";
import { CommunityVote, CommunityDiscussion } from "./engagement";
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";
export interface CommunityTheme {
  accent?: string;
  className?: string;
}
export function CommunityCards({
  areas,
  href,
  label = "Explore the guide",
}: {
  areas: CommunityMapArea[];
  href: (area: CommunityMapArea) => string;
  label?: string;
}) {
  return (
    <nav className="smcm-community-grid" aria-label="Explore by community">
      {areas.map((a) => (
        <a className="smcm-community-card" key={a.id} href={href(a)}>
          <span>{a.name}</span>
          <span className="smcm-card-action">
            {label} <span aria-hidden="true">↗</span>
          </span>
        </a>
      ))}
    </nav>
  );
}
export function CommunityFeatureCard({
  feature,
  href,
  photoUrl,
  client,
  collection,
  signInHref,
}: {
  feature: CommunityMapFeature;
  href: string;
  photoUrl?: string;
  client?: CommunityMapsClient;
  collection?: CommunityMapCollection;
  signInHref?: string;
}) {
  return (
    <article className="smcm-feature-card">
      {photoUrl && (
        <img
          loading="lazy"
          src={photoUrl}
          alt={
            feature.media.find(
              (m) => !m.content_type || m.content_type.startsWith("image/"),
            )?.caption || feature.content.title
          }
        />
      )}
      <div className="smcm-feature-copy">
        <p className="smcm-eyebrow">
          {feature.featured ? "Editor’s pick · " : ""}
          {feature.content.location_label}
        </p>
        <h3>
          <a href={href}>{feature.content.title}</a>
        </h3>
        <p>{feature.content.description}</p>
        {client && collection?.config.voting_enabled && (
          <CommunityVote
            key={feature.id}
            client={client}
            slug={collection.slug}
            featureId={feature.id}
            signInHref={signInHref}
            compact
          />
        )}
        {collection?.config.comments_enabled && (
          <p>
            <a href={`${href}#comments`}>Join the conversation</a>
          </p>
        )}
        <div className="smcm-feature-meta">
          <span>
            {feature.content.geometry.type === "Point"
              ? "Place"
              : feature.content.geometry.type === "LineString"
                ? "Street / route"
                : "Neighborhood / area"}
          </span>
          {feature.verified && <span>Verified by editors</span>}
        </div>
      </div>
    </article>
  );
}
export function FeaturedAttractions({
  features,
  href,
  client,
  slug,
}: {
  features: CommunityMapFeature[];
  href: (f: CommunityMapFeature) => string;
  client: CommunityMapsClient;
  slug: string;
}) {
  return (
    <div className="smcm-feature-grid">
      {features
        .filter((f) => f.featured && !f.content.residential)
        .map((f) => (
          <CommunityFeatureCard
            key={f.id}
            feature={f}
            href={href(f)}
            photoUrl={
              f.media.find(
                (m) => !m.content_type || m.content_type.startsWith("image/"),
              )
                ? client.mediaUrl(
                    slug,
                    f.media.find(
                      (m) =>
                        !m.content_type || m.content_type.startsWith("image/"),
                    )!.id,
                  )
                : undefined
            }
          />
        ))}
    </div>
  );
}
export function FeaturedStreets({
  features,
  href,
  client,
  slug,
}: {
  features: CommunityMapFeature[];
  href: (f: CommunityMapFeature) => string;
  client: CommunityMapsClient;
  slug: string;
}) {
  return (
    <div className="smcm-feature-grid">
      {features
        .filter((f) => f.featured && f.content.geometry.type === "LineString")
        .map((f) => (
          <CommunityFeatureCard
            key={f.id}
            feature={f}
            href={href(f)}
            photoUrl={
              f.media.find(
                (m) => !m.content_type || m.content_type.startsWith("image/"),
              )
                ? client.mediaUrl(
                    slug,
                    f.media.find(
                      (m) =>
                        !m.content_type || m.content_type.startsWith("image/"),
                    )!.id,
                  )
                : undefined
            }
          />
        ))}
    </div>
  );
}
export function CommunityReaction({
  client,
  collection,
  feature,
}: {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  feature: CommunityMapFeature;
}) {
  const [counts, setCounts] = useState(feature.reactions);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function react(key: string) {
    setBusy(key);
    setError("");
    try {
      const r = await client.react(
        collection.slug,
        feature.id,
        key,
        !active[key],
      );
      setCounts((c) => ({ ...c, [key]: r.count }));
      setActive((a) => ({ ...a, [key]: r.active }));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="smcm-reactions" aria-label="Appreciate this place">
      {collection.config.reactions.map((r) => (
        <button
          type="button"
          key={r.key}
          disabled={busy !== null}
          aria-pressed={!!active[r.key]}
          onClick={() => void react(r.key)}
        >
          <span aria-hidden="true">{r.icon}</span> {r.label}{" "}
          <span className="smcm-count">{counts[r.key] || 0}</span>
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function useRequestKey() {
  const last = useRef<{ body: string; key: string }>();
  return (body: unknown) => {
    const serialized = JSON.stringify(body);
    if (!last.current || last.current.body !== serialized)
      last.current = { body: serialized, key: crypto.randomUUID() };
    return last.current.key;
  };
}
/** @deprecated Use CommunityMediaSubmission for photos, video and audio. */
export function CommunityPhotoSubmission(props: {
  client: CommunityMapsClient;
  slug: string;
  submission: string;
  policy?: CommunityMapSubmissionPolicy;
}) {
  const [policy, setPolicy] = useState(props.policy);
  const [error, setError] = useState("");
  useEffect(() => {
    if (props.policy) return;
    let closed = false;
    props.client
      .collection(props.slug)
      .then((c) => {
        if (!closed) setPolicy(c.submission_policy);
      })
      .catch((e) => {
        if (!closed) setError(message(e));
      });
    return () => {
      closed = true;
    };
  }, [props.client, props.slug, props.policy]);
  return policy ? (
    <CommunityMediaSubmission {...props} policy={policy} />
  ) : (
    <p role="status">{error || "Loading publication permission…"}</p>
  );
}
export function CommunitySubmissionForm({
  client,
  collection,
  initialAreaId,
  correctionFor,
  guidelinesHref,
  termsHref,
}: {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  initialAreaId?: string;
  correctionFor?: string;
  guidelinesHref?: string;
  termsHref?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const key = useRequestKey();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [position, setPosition] = useState<DevicePosition | null>(null);
  /** Answer to "Are you at this display right now?"; asked once photos are chosen. */
  const [atDisplay, setAtDisplay] = useState<"unanswered" | "no">("unanswered");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locationHelpId = useId();
  const atDisplayId = useId();
  function readCurrentLocation() {
    setLocating(true);
    setLocationError("");
    readDevicePosition("at-display")
      .then(setPosition)
      .catch((e) =>
        setLocationError(
          e instanceof DevicePositionUnavailable && e.reason === "unsupported"
            ? "Location is not available in this browser."
            : "We could not read your location. Enter the address or nearest intersection instead.",
        ),
      )
      .finally(() => setLocating(false));
  }
  const [retry, setRetry] = useState({
    files: [] as File[],
    caption: "",
    attribution: "",
    message: "",
  });
  const policy = collection.submission_policy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) || "").trim();
    setBusy(true);
    setError("");
    const proposal: CommunityMapProposal = {
      title: field("title"),
      description: field("description"),
      location_text: field("location"),
      contact_email: field("email") || null,
      contact_name: field("name") || null,
      contributor_claim: field(
        "claim",
      ) as CommunityMapProposal["contributor_claim"],
      category: field("category"),
      hours: field("hours") || null,
      correction_for: correctionFor || null,
      exact_geometry: position
        ? {
            type: "Point",
            coordinates: [position.longitude, position.latitude],
          }
        : null,
    };
    if (!policy) {
      setBusy(false);
      setError("Reload the guide to read the current publication permission.");
      return;
    }
    const input = {
      area_id: field("area"),
      proposal,
      consent: {
        version: policy.version,
        accepted: data.get("rights") === "on",
      },
    };
    try {
      if (!input.consent.accepted)
        throw new Error(
          "Agree to the publication permission before submitting.",
        );
      validateCommunityMedia(attachments);
      const r = await client.submit(collection.slug, {
        ...input,
        idempotency_key: key(input),
      });
      let received = 0;
      let unplaced = 0;
      let uploadMessage = "";
      const device_position = toUploadPosition(position);
      try {
        for (const file of attachments) {
          const receipt = await client.upload(collection.slug, r.id, file, {
            caption: field("caption"),
            attribution: field("attribution"),
            rights_confirmed: input.consent.accepted,
            consent_version: policy.version,
            device_position,
          });
          received++;
          if (receipt.position_captured === false && !device_position)
            unplaced++;
        }
        if (received)
          uploadMessage =
            `${received} attachment(s) received for editorial review.` +
            (unplaced
              ? " Your photo(s) carried no location data; editors will place the display from the street you gave."
              : "");
      } catch (error) {
        uploadMessage = `${received} attachment(s) received. Remaining attachments need to be retried: ${message(error)}`;
      }
      setRetry({
        files: attachments.slice(received),
        caption: field("caption"),
        attribution: field("attribution"),
        message: uploadMessage,
      });
      setReceipt(r.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (receipt && policy)
    return (
      <section className="smcm-submission-receipt">
        <h2>Thank you for contributing.</h2>
        <p role="status">
          Your place was received. Editors will review it and each attachment
          against the publication guidelines. Nothing is published
          automatically.
        </p>
        <CommunityMediaSubmission
          client={client}
          slug={collection.slug}
          submission={receipt}
          policy={policy}
          initialFiles={retry.files}
          initialCaption={retry.caption}
          initialAttribution={retry.attribution}
          initialMessage={retry.message}
          guidelinesHref={guidelinesHref}
          termsHref={termsHref}
          devicePosition={toUploadPosition(position)}
        />
      </section>
    );
  if (!communitySubmissionsOpen(collection))
    return <p>Submissions are currently closed for this guide.</p>;
  return (
    <form className="smcm-form" onSubmit={submit}>
      <h2>
        {correctionFor
          ? "Suggest a correction"
          : "Share a place with your community"}
      </h2>
      <p>
        Every contribution is reviewed. For residential displays, the public
        guide generally shows a street or neighborhood.
      </p>
      <div className="smcm-form-grid">
        <label>
          Community
          <select
            name="area"
            defaultValue={initialAreaId || collection.areas[0]?.id}
            required
          >
            {collection.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="category" required>
            {collection.config.categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Name of place or display
        <input name="title" required maxLength={191} />
      </label>
      <label>
        Description
        <textarea name="description" required maxLength={12000} rows={4} />
      </label>
      <label>
        Location for editorial review
        <input name="location" required maxLength={2000} />
      </label>
      <p className="smcm-help">
        An address or nearest intersection helps us verify the location. This
        field is private and is not copied into the public guide.
      </p>
      <div className="smcm-current-location">
        <button
          type="button"
          className="smcm-button smcm-button-quiet"
          onClick={readCurrentLocation}
          disabled={busy || locating}
          aria-describedby={locationHelpId}
        >
          {locating
            ? "Reading your location…"
            : position
              ? "Update my current location"
              : "Use my current location"}
        </button>
        {position && (
          <span role="status" className="smcm-current-location-value">
            Location attached ({position.latitude.toFixed(5)},{" "}
            {position.longitude.toFixed(5)}, about {position.accuracy} m).{" "}
            <button
              type="button"
              className="smcm-link"
              disabled={busy}
              onClick={() => setPosition(null)}
            >
              Remove
            </button>
          </span>
        )}
        {locationError && (
          <span role="alert" className="smcm-help">
            {locationError}
          </span>
        )}
      </div>
      <p id={locationHelpId} className="smcm-help">
        If you are standing at the display, this pins it for editors. Photo
        location data is read the same way. Both stay private; the public guide
        shows only the street or neighborhood editors approve.
      </p>
      <label>
        Dates and visiting hours
        <input
          name="hours"
          maxLength={1000}
          placeholder="For example: October 24–31, 6–9 pm"
        />
      </label>
      <label>
        Your connection
        <select name="claim">
          <option value="visitor">Visitor or neighbor</option>
          <option value="resident">Resident</option>
          <option value="owner">Property owner</option>
          <option value="organizer">Organizer</option>
          <option value="other">Other</option>
        </select>
      </label>
      <p className="smcm-help">
        This identifies your relationship; editors still need to verify details.
      </p>
      <div className="smcm-form-grid">
        <label>
          Your name (private, optional)
          <input name="name" maxLength={191} autoComplete="name" />
        </label>
        <label>
          Email (private, optional)
          <input
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
          />
        </label>
      </div>
      <p className="smcm-help">
        Provide an email if you would like editors to contact you with
        questions. Your name and email stay private; use the public credit field
        if you want attribution.
      </p>
      <CommunityMediaFields
        onFiles={(files) => {
          setAttachments(files);
          if (!files.length) setAtDisplay("unanswered");
        }}
      />
      {attachments.length > 0 && !position && atDisplay === "unanswered" && (
        <div
          className="smcm-at-display"
          role="group"
          aria-labelledby={atDisplayId}
          aria-describedby={`${atDisplayId}-why`}
        >
          <p>
            <strong id={atDisplayId}>Are you at this display right now?</strong>{" "}
            <span id={`${atDisplayId}-why`}>
              Most phones do not save a location inside the photo. Pinning where
              you stand helps editors put it on the right block; it stays
              private.
            </span>
          </p>
          {locationError && (
            <p role="alert" className="smcm-help">
              {locationError}
            </p>
          )}
          <div className="smcm-form-actions">
            <button
              type="button"
              className="smcm-button"
              disabled={busy || locating}
              onClick={readCurrentLocation}
            >
              {locating ? "Reading your location…" : "Yes, pin my location"}
            </button>
            <button
              type="button"
              className="smcm-button smcm-button-quiet"
              disabled={busy}
              onClick={() => setAtDisplay("no")}
            >
              No, I’m somewhere else
            </button>
          </div>
        </div>
      )}
      {attachments.length > 0 && !position && atDisplay === "no" && (
        <p className="smcm-help" role="status">
          No problem. Editors will place it from the street you typed above.
        </p>
      )}
      {policy ? (
        <PublicationPermission
          policy={policy}
          guidelinesHref={guidelinesHref}
          termsHref={termsHref}
        />
      ) : (
        <p role="alert">
          Publication permission is temporarily unavailable. Please reload
          before submitting.
        </p>
      )}
      <button disabled={busy || !collection.areas.length || !policy}>
        {busy ? "Submitting…" : "Send to the editors"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
const reportReasons: [CommunityMapReportReason, string][] = [
  ["no-longer-exists", "Display or place no longer exists"],
  ["incorrect-location", "Incorrect location"],
  ["incorrect-information", "Incorrect information"],
  ["inappropriate-media", "Inappropriate photo, video or audio"],
  ["duplicate", "Duplicate place"],
  ["safety", "Safety concern"],
  ["privacy-removal", "Resident or property owner removal request"],
  ["other", "Other"],
];
export function CommunityReportForm({
  client,
  slug,
  featureId,
}: {
  client: CommunityMapsClient;
  slug: string;
  featureId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState("");
  const key = useRequestKey();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      reason: String(data.get("reason")) as CommunityMapReportReason,
      details: String(data.get("details") || ""),
      contact_email: String(data.get("email") || "") || null,
    };
    setBusy(true);
    setError("");
    try {
      await client.report(slug, featureId, {
        ...input,
        idempotency_key: key(input),
      });
      setReceived(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return received ? (
    <p role="status">
      Your report has been sent to the editors. Privacy and safety requests
      receive priority.
    </p>
  ) : (
    <form className="smcm-form" onSubmit={submit}>
      <h3>Report a problem or request removal</h3>
      <label>
        Reason
        <select name="reason">
          {reportReasons.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Details for the editors
        <textarea name="details" required maxLength={6000} />
      </label>
      <label>
        Email (private, optional)
        <input type="email" name="email" maxLength={254} />
      </label>
      <button disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function CommunityFeatureDetail({
  client,
  collection,
  feature,
  correctionHref,
  signInHref,
}: {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  feature: CommunityMapFeature;
  correctionHref?: string;
  signInHref?: string;
}) {
  const c = feature.content;
  return (
    <article className="smcm-detail">
      <p className="smcm-eyebrow">{c.location_label}</p>
      <h1>{c.title}</h1>
      <p className="smcm-description">{c.description}</p>
      <dl className="smcm-facts">
        {[
          ["Location", c.location_label],
          ["Hours", c.hours],
          ["Admission", c.admission],
          ["Accessibility", c.accessibility],
          [
            "Family friendly",
            c.family_friendly === null
              ? null
              : c.family_friendly
                ? "Yes"
                : "See details",
          ],
        ].map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {c.residential && (
        <p className="smcm-help">
          The location shown is approximate or limited to the street or
          neighborhood. Respect residents’ privacy and view displays from public
          areas.
        </p>
      )}
      {c.external_url && (
        <p>
          <a href={c.external_url} target="_blank" rel="noopener noreferrer">
            Visit the official website ↗
          </a>
        </p>
      )}
      <CommunityMap
        features={[feature]}
        areas={collection.areas}
        styleUrl={collection.config.presentation.map_style_url}
        accent={collection.config.presentation.accent || undefined}
      />
      <div className="smcm-photos">
        {feature.media.map((m) => (
          <figure key={m.id}>
            {m.content_type?.startsWith("video/") ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={client.mediaUrl(collection.slug, m.id)}
                aria-label={m.caption || c.title}
              />
            ) : m.content_type?.startsWith("audio/") ? (
              <audio
                controls
                preload="metadata"
                src={client.mediaUrl(collection.slug, m.id)}
                aria-label={m.caption || c.title}
              />
            ) : (
              <img
                src={client.mediaUrl(collection.slug, m.id)}
                alt={m.caption || c.title}
                loading="lazy"
              />
            )}
            <figcaption>
              {m.caption}
              {m.attribution && <span> Credit: {m.attribution}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      {collection.config.voting_enabled && (
        <CommunityVote
          key={`vote-${feature.id}`}
          client={client}
          slug={collection.slug}
          featureId={feature.id}
          signInHref={signInHref}
        />
      )}
      <CommunityReaction
        key={feature.id}
        client={client}
        collection={collection}
        feature={feature}
      />
      {c.sources.length > 0 && (
        <section>
          <h2>Sources</h2>
          <ul>
            {c.sources.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a href={s.url} rel="noopener noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                {s.attribution && ` — ${s.attribution}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.related_story_urls.length > 0 && (
        <section>
          <h2>Related reporting</h2>
          <ul>
            {c.related_story_urls.map((url, i) => (
              <li key={url}>
                <a href={url}>Read related story {i + 1} ↗</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {correctionHref && (
        <p>
          <a href={correctionHref}>Suggest an update</a>
        </p>
      )}
      <div id="comments">
        <CommunityDiscussion
          key={`comments-${feature.id}`}
          client={client}
          collection={collection}
          featureId={feature.id}
          title="Comments on this place"
        />
      </div>
      <details>
        <summary>Report a problem or request removal</summary>
        <CommunityReportForm
          client={client}
          slug={collection.slug}
          featureId={feature.id}
        />
      </details>
    </article>
  );
}
export interface CommunityGuideProps {
  client: CommunityMapsClient;
  collection: CommunityMapCollection;
  initialPage?: CommunityMapPage<CommunityMapFeature>;
  initialAreaId?: string;
  featureHref: (feature: CommunityMapFeature) => string;
  communityHref: (area: CommunityMapArea) => string;
  submitHref: string;
  theme?: CommunityTheme;
  mapProvider?: CommunityMapProvider;
  intro?: ReactNode;
  showMap?: boolean;
  signInHref?: (feature: CommunityMapFeature) => string;
}
export function CommunityGuide({
  client,
  collection,
  initialPage,
  initialAreaId = "",
  featureHref,
  communityHref,
  submitHref,
  theme,
  mapProvider,
  intro,
  showMap = true,
  signInHref,
}: CommunityGuideProps) {
  const [area, setArea] = useState(initialAreaId);
  const [category, setCategory] = useState("");
  const [featured, setFeatured] = useState(false);
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(initialPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState<string>();
  const [bbox, setBbox] = useState<string>();
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const query = useMemo<CommunityMapFeatureQuery>(
    () => ({
      area_id: area || undefined,
      category: category || undefined,
      featured: featured || undefined,
      geometry_type:
        (kind as CommunityMapFeatureQuery["geometry_type"]) || undefined,
      bbox,
      limit: 50,
    }),
    [area, category, featured, kind, bbox],
  );
  useEffect(() => {
    const abort = new AbortController();
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setPage(undefined);
    client
      .features(collection.slug, query, abort.signal)
      .then((r) => {
        if (current === generation.current) setPage(r);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [client, collection.slug, query, retry]);
  async function more() {
    if (!page?.next_cursor) return;
    const current = generation.current;
    setBusy(true);
    try {
      const next = await client.features(collection.slug, {
        ...query,
        after: page.next_cursor,
      });
      if (current === generation.current)
        setPage((p) => ({
          items: [...(p?.items || []), ...next.items],
          next_cursor: next.next_cursor,
        }));
    } catch (e) {
      setError(message(e));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  const accent =
    theme?.accent || collection.config.presentation.accent || "#a64916";
  return (
    <div
      className={`smcm ${theme?.className || ""}`}
      style={{ "--smcm-accent": accent } as CSSProperties}
    >
      <header className="smcm-guide-header">
        <p className="smcm-eyebrow">The community guide</p>
        <h1>{collection.config.title}</h1>
        <p>{collection.config.description}</p>
        {intro}
        <a className="smcm-button" href={submitHref}>
          Share a place ↗
        </a>
      </header>
      <CommunityCards
        areas={collection.areas}
        href={communityHref}
        label={`Explore ${collection.config.presentation.season || "the guide"}`}
      />
      <section aria-label="Explore places">
        <div className="smcm-filters">
          <label>
            Community
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setBbox(undefined);
              }}
            >
              <option value="">All communities</option>
              {collection.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {collection.config.categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Show
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All places</option>
              <option value="LineString">Streets & routes</option>
              <option value="Polygon">Neighborhoods & areas</option>
              <option value="Point">Attractions & places</option>
            </select>
          </label>
          <label className="smcm-check">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            Editor’s picks
          </label>
        </div>
        {showMap && (
          <>
            <CommunityMap
              features={page?.items || []}
              areas={collection.areas.filter((a) => !area || a.id === area)}
              styleUrl={collection.config.presentation.map_style_url}
              accent={accent}
              provider={mapProvider}
              onSelect={(id) => {
                const feature = page?.items.find((f) => f.id === id);
                if (feature) window.location.assign(featureHref(feature));
              }}
              onBounds={(bounds) => setViewport(bounds.join(","))}
            />
            {viewport && (
              <button
                type="button"
                className="smcm-map-search"
                onClick={() => setBbox(viewport)}
              >
                Search this map area
              </button>
            )}
            {bbox && (
              <button type="button" onClick={() => setBbox(undefined)}>
                Clear map area
              </button>
            )}
          </>
        )}
        <p role="status" aria-live="polite">
          {busy
            ? "Loading places…"
            : page?.items.length
              ? `${page.items.length} places shown${page.next_cursor ? " · More available" : ""}`
              : error
                ? ""
                : "No published places match these filters yet. Help build this guide by sharing a place."}
        </p>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}
        <div className="smcm-feature-grid">
          {page?.items.map((f) => (
            <CommunityFeatureCard
              key={f.id}
              feature={f}
              client={client}
              collection={collection}
              signInHref={signInHref?.(f)}
              href={featureHref(f)}
              photoUrl={
                f.media.find(
                  (m) => !m.content_type || m.content_type.startsWith("image/"),
                )
                  ? client.mediaUrl(
                      collection.slug,
                      f.media.find(
                        (m) =>
                          !m.content_type ||
                          m.content_type.startsWith("image/"),
                      )!.id,
                    )
                  : undefined
              }
            />
          ))}
        </div>
        {page?.next_cursor && (
          <button type="button" disabled={busy} onClick={() => void more()}>
            Show more places
          </button>
        )}
      </section>
      <footer className="smcm-guide-note">
        Residential locations are reviewed for privacy. Details can change;
        check visiting hours and respect your neighbors.
      </footer>
    </div>
  );
}
