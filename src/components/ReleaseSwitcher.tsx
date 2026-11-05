import { useEffect, useId, useRef, useState } from 'react';
import { parseReleaseManifest, type Release } from '../lib/releases';

function optionText(release: Release): string {
  const name = release.unreleased ? `${release.label}, unreleased` : release.label;
  return release.cweVersion === null ? name : `${name} (CWE ${release.cweVersion})`;
}

// The same page in another release. The query string carries the selected
// CWE, so the other release opens on it, or says it has no such CWE, as it
// would for any ?cwe= it doesn't know.
function hrefIn(release: Release): string {
  return `${release.path}${window.location.search}${window.location.hash}`;
}

/**
 * Switches between the releases the site serves, listed in the root
 * manifest scripts/build-site.ts writes. Renders nothing where there is no
 * manifest, or the app isn't one of the releases it lists: a PR preview and
 * the dev server serve a single app at / with nothing to switch to.
 */
export function ReleaseSwitcher() {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    // From the site root, not the base path: a release is never rebuilt, so
    // only the root's copy, rewritten by every production build, knows about
    // the releases cut after it. The URL never changes, so a late response
    // can't be stale, and React ignores it if the header has unmounted.
    fetch('/data/releases.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => setReleases(parseReleaseManifest(json)))
      .catch(() => {
        // No manifest (or not JSON): leave the switcher hidden.
      });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const current = releases?.find((release) => release.path === import.meta.env.BASE_URL);
  if (!releases || !current) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="release-switcher"
      onBlur={(event) => {
        // Tabbing out of the list closes it, as a click outside does.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="release-switcher__button"
        aria-label={`Release: ${optionText(current)}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {current.label}
        <span aria-hidden="true"> ▾</span>
      </button>
      {open && (
        <ul id={listId} className="release-switcher__list" aria-label="Releases">
          {releases.map((release) => (
            <li key={release.path}>
              <a
                className="release-switcher__option"
                href={hrefIn(release)}
                aria-current={release === current ? 'page' : undefined}
              >
                {optionText(release)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
