import { useEffect, useState } from 'react';
import { applyTheme, readStoredTheme, storeTheme, systemTheme, type Theme } from '../lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? systemTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        storeTheme(next);
        setTheme(next);
      }}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
    </button>
  );
}
