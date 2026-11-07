import { NARROW_QUERY, useMediaQuery } from '../lib/media';

interface AttributionProps {
  /** The catalog's release date, YYYY-MM-DD; its year ends MITRE's copyright range. */
  catalogDate: string;
}

export function Attribution({ catalogDate }: AttributionProps) {
  const year = catalogDate.slice(0, 4);
  // The full notice runs to five lines on a phone, height the graph needs,
  // so there it folds to one line that opens to all of it.
  const narrow = useMediaQuery(NARROW_QUERY);
  const notice = (
    <>
      CWE content is not original to this project. Copyright © 2006–{year},{' '}
      <a href="https://www.mitre.org/" target="_blank" rel="noreferrer">
        The MITRE Corporation
      </a>
      ; CWE is a trademark of The MITRE Corporation, reproduced here under its{' '}
      <a href="https://cwe.mitre.org/about/termsofuse.html" target="_blank" rel="noreferrer">
        Terms of Use
      </a>
      . This project is not affiliated with or endorsed by MITRE —{' '}
      <a href="https://cwe.mitre.org/" target="_blank" rel="noreferrer">
        cwe.mitre.org
      </a>{' '}
      is authoritative.
    </>
  );

  return (
    <footer className="app-footer">
      {narrow ? (
        <details>
          <summary>CWE content © 2006–{year} The MITRE Corporation</summary>
          {notice}
        </details>
      ) : (
        notice
      )}
    </footer>
  );
}
