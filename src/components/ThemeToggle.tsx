import { useEffect, useState } from 'react';
import { useMediaQuery } from '../lib/media';
import { applyTheme, readStoredTheme, storeTheme, type Theme } from '../lib/theme';

export function ThemeToggle() {
  // null means "never chose one" — and that must stay null, because writing
  // data-theme is what takes the stylesheet's prefers-color-scheme block out
  // of play. Pinning it on mount would freeze an untouched app to whatever
  // the OS happened to prefer at load.
  const [chosen, setChosen] = useState<Theme | null>(() => readStoredTheme());
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme: Theme = chosen ?? (prefersDark ? 'dark' : 'light');

  useEffect(() => {
    if (chosen) applyTheme(chosen);
  }, [chosen]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        storeTheme(next);
        setChosen(next);
      }}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
    </button>
  );
}
