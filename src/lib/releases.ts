// The shape of the site's release manifest, /data/releases.json: written at
// the site root by scripts/build-site.ts in the production layout, and read
// by every release at runtime. A release is built once and keeps serving the
// same files, so it learns about releases cut after it only by reading this
// file, which every production build rewrites. Both sides import these types
// from here, so the file's producer and consumer can't drift apart.

export interface Release {
  /** The path the release is served from, with both slashes: `/v1.1/`. */
  path: string;
  /** What the switcher shows: `1.1`, or `Latest`. */
  label: string;
  /** True only for `/latest/`, which follows `main`. */
  unreleased: boolean;
  /** The CWE version the release serves, or null if its data is unreadable. */
  cweVersion: string | null;
}

export interface ReleaseManifest {
  /** `/latest/` first, then the releases from newest to oldest. */
  releases: Release[];
}

function isRelease(value: unknown): value is Release {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.path === 'string' &&
    typeof r.label === 'string' &&
    typeof r.unreleased === 'boolean' &&
    (typeof r.cweVersion === 'string' || r.cweVersion === null)
  );
}

/**
 * The releases in a manifest, or null if it isn't one. The file is fetched
 * from the site root, which outside the production layout (a PR preview, the
 * dev server) holds no manifest and may answer with anything.
 */
export function parseReleaseManifest(json: unknown): Release[] | null {
  if (typeof json !== 'object' || json === null) {
    return null;
  }
  const { releases } = json as Record<string, unknown>;
  if (!Array.isArray(releases) || !releases.every(isRelease)) {
    return null;
  }
  return releases;
}
