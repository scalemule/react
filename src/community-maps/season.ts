import type { CommunityMapCollection } from "@scalemule/sdk";

/** Pre-season contributions are allowed; the service remains authoritative. */
export function communitySubmissionsOpen(
  collection: CommunityMapCollection,
  now = Date.now(),
): boolean {
  const end = collection.config.ends_at;
  return collection.config.submissions_open && (!end || now < Date.parse(end));
}
