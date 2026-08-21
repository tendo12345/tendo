// @vitest-environment jsdom

/**
 * The global vitest environment stays `node` so the 239 engine tests keep running without
 * a DOM. This file opts itself into jsdom via the docblock above, which is the only part
 * of the suite that needs one.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemePreference } from './useThemePreference';

const KEY = 'dsg-theme';

/** Drive `prefers-color-scheme` and let tests fire a change at it. */
function mockSystemTheme(dark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return {
    change(nowDark: boolean) {
      mql.matches = nowDark;
      act(() => {
        listeners.forEach((fn) => fn({ matches: nowDark } as MediaQueryListEvent));
      });
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useThemePreference', () => {
  it('restores an explicit choice from localStorage', () => {
    localStorage.setItem(KEY, 'dark');
    mockSystemTheme(false);

    const { result } = renderHook(() => useThemePreference());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isExplicit).toBe(true);
  });

  it('follows the system when nothing is stored', () => {
    mockSystemTheme(true);

    const { result } = renderHook(() => useThemePreference());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isExplicit).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('persists the choice when toggled', () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useThemePreference());

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isExplicit).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('survives a remount, which is the whole point', () => {
    mockSystemTheme(false);
    const first = renderHook(() => useThemePreference());
    act(() => first.result.current.setTheme('dark'));
    first.unmount();

    const second = renderHook(() => useThemePreference());
    expect(second.result.current.theme).toBe('dark');
  });

  it('keeps following the system while no choice has been made', () => {
    const system = mockSystemTheme(false);
    const { result } = renderHook(() => useThemePreference());
    expect(result.current.theme).toBe('light');

    system.change(true);

    expect(result.current.theme).toBe('dark');
    expect(result.current.isExplicit).toBe(false);
  });

  it('ignores the system once the user has chosen', () => {
    const system = mockSystemTheme(false);
    const { result } = renderHook(() => useThemePreference());
    act(() => result.current.setTheme('light'));

    system.change(true);

    expect(result.current.theme).toBe('light');
  });

  it('can stop overriding and follow the system again', () => {
    localStorage.setItem(KEY, 'light');
    mockSystemTheme(true);
    const { result } = renderHook(() => useThemePreference());
    expect(result.current.theme).toBe('light');

    act(() => result.current.clearPreference());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isExplicit).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('applies data-theme to the document by default', () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useThemePreference());

    act(() => result.current.setTheme('dark'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('leaves the document alone when apply is off', () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useThemePreference({ apply: false }));

    act(() => result.current.setTheme('dark'));

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('picks up a change made in another tab', () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useThemePreference());
    expect(result.current.theme).toBe('light');

    act(() => {
      localStorage.setItem(KEY, 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'dark' }));
    });

    expect(result.current.theme).toBe('dark');
  });

  it('shares one storage key with lib/theme, so the two cannot disagree', () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useThemePreference());

    act(() => result.current.setTheme('dark'));

    // The context reads this exact key via getStoredTheme().
    expect(localStorage.getItem('dsg-theme')).toBe('dark');
    expect(Object.keys(localStorage)).toEqual(['dsg-theme']);
  });

  it('does not throw when storage is unavailable', () => {
    mockSystemTheme(false);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useThemePreference());
    expect(() => act(() => result.current.toggleTheme())).not.toThrow();
    // The choice still applies for this session, it just will not survive a reload.
    expect(result.current.theme).toBe('dark');

    setItem.mockRestore();
  });
});
