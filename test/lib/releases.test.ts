import { describe, it, expect } from 'vitest';
import { parseReleaseManifest } from '../../src/lib/releases';

const latest = { path: '/latest/', label: 'Latest', unreleased: true, cweVersion: '4.22' };
const v1 = { path: '/v1/', label: '1.0', unreleased: false, cweVersion: null };

describe('parseReleaseManifest', () => {
  it('returns the releases of a manifest', () => {
    expect(parseReleaseManifest({ releases: [latest, v1] })).toEqual([latest, v1]);
  });

  // The manifest is newer than the release reading it, so a release cut
  // today may one day read a manifest in a format it doesn't know. Outside
  // the production layout the root holds no manifest at all.
  it('rejects anything that is not a manifest it understands', () => {
    for (const json of [
      null,
      'releases',
      [latest],
      {},
      { releases: 'v1' },
      { releases: [latest, null] },
      { releases: [{ ...latest, path: 1 }] },
      { releases: [{ ...latest, label: undefined }] },
      { releases: [{ ...latest, unreleased: 'yes' }] },
      { releases: [{ ...latest, cweVersion: 4.22 }] },
    ]) {
      expect(parseReleaseManifest(json)).toBeNull();
    }
  });
});
