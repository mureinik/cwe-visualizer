export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cwe-visualizer-theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * Every storage access is wrapped: a private window, cleared site data, or a
 * blocked-cookies setting makes these throw rather than return null, and a
 * theme preference is never worth breaking the app over.
 */
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Preference simply won't persist; the session still honours it.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function systemTheme(): Theme {
  if (typeof matchMedia !== 'function') return 'light';
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
