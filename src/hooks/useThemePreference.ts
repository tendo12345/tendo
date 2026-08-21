import { useCallback, useEffect, useState } from 'react';
import { applyTheme, clearStoredTheme, getStoredTheme, storeTheme } from '../lib/theme';
import type { Theme } from '../types/ui';

/**
 * Theme preference, persisted to localStorage.
 *
 * NOT CURRENTLY USED. `ThemeContext` already does this for the running app; this is a
 * standalone alternative for cases that need the behaviour without the provider.
 *
 * It deliberately reuses `lib/theme.ts` rather than reading localStorage itself, so it
 * shares the one `dsg-theme` key with the context. A second key would mean two sources of
 * truth that silently disagree — the toggle would appear to work, then the wrong theme
 * would come back on reload depending on which mechanism wrote last. If this ever does get
 * wired in, replace the context's persistence rather than running both.
 *
 * Three states matter, not two:
 *   - an explicit stored choice, which wins
 *   - no choice, following the system, which keeps following it as the OS setting changes
 *   - `clearPreference()`, which returns to following the system
 * Collapsing the last two into "light" loses the user's ability to stop overriding.
 */

export interface ThemePreference {
  /** The theme in effect, whether chosen or inherited from the system. */
  theme: Theme;
  /** True when the user picked this explicitly; false when it is following the system. */
  isExplicit: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Forget the stored choice and follow the system again. */
  clearPreference: () => void;
}

export interface UseThemePreferenceOptions {
  /**
   * Write `data-theme` onto the document element on change. Leave this on for a hook that
   * drives the page; turn it off to use it purely as a store, or the attribute will fight
   * whatever else is setting it.
   */
  apply?: boolean;
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemePreference(options: UseThemePreferenceOptions = {}): ThemePreference {
  const { apply = true } = options;

  // `null` means "no explicit choice" and is a real state, distinct from light.
  const [stored, setStored] = useState<Theme | null>(() => getStoredTheme());
  const [system, setSystem] = useState<Theme>(systemTheme);

  const theme = stored ?? system;

  // Keep following the OS while the user has expressed no preference of their own.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Another tab changing the preference should not leave this one stale.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = () => setStored(getStoredTheme());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (apply) applyTheme(theme);
  }, [apply, theme]);

  const setTheme = useCallback((next: Theme) => {
    // Written before the state update so a reload mid-render still gets the new value.
    storeTheme(next);
    setStored(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const clearPreference = useCallback(() => {
    clearStoredTheme();
    setStored(null);
    setSystem(systemTheme());
  }, []);

  return { theme, isExplicit: stored !== null, setTheme, toggleTheme, clearPreference };
}
