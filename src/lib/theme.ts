import type { Theme } from '../types/ui';

const STORAGE_KEY = 'dsg-theme';

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private browsing / storage disabled — theme just won't persist
  }
}

/** Forget the stored choice, so the app follows `prefers-color-scheme` again. */
export function clearStoredTheme(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage disabled — nothing was persisted to remove
  }
}

export function applyTheme(theme: Theme | null): void {
  const root = document.documentElement;
  if (theme) {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
}
