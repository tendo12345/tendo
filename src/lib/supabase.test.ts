import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Whether supabase-js has anything to do, decided without loading it.

  The failure that matters is a false negative: a visitor with a real session read as signed
  out, shown "Log in", and — worse — their magic-link callback left unprocessed. So every way
  the library itself recognises a session or a callback is checked here, against the storage
  key format and URL parameters of the installed auth-js (2.112), not against assumptions.
*/

const PROJECT_URL = 'https://bwflicstehguophbzyil.supabase.co';

function fakeStorage(keys: string[]) {
  const map = new Map(keys.map((k) => [k, '{}']));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as unknown as Storage;
}

async function load(storageKeys: string[] = []) {
  vi.stubGlobal('localStorage', fakeStorage(storageKeys));
  vi.resetModules();
  return import('./supabase');
}

const at = (search: string, hash = '') => ({ search, hash });

describe('with accounts configured', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('derives the storage key the way supabase-js does', async () => {
    const { AUTH_STORAGE_KEY } = await load();
    expect(AUTH_STORAGE_KEY).toBe('sb-bwflicstehguophbzyil-auth-token');
  });

  it('reads a visitor with nothing stored and no callback as signed out', async () => {
    const { hasPendingAuth } = await load(['basis-saved-systems', 'dsg-theme']);
    expect(hasPendingAuth(at('', ''))).toBe(false);
    expect(hasPendingAuth(at('?p=fintech&i=payments&k=mobile', ''))).toBe(false);
    // A section anchor, as SectionNav writes, is not a callback.
    expect(hasPendingAuth(at('', '#typography'))).toBe(false);
  });

  it('finds a stored session', async () => {
    const { hasPendingAuth } = await load(['sb-bwflicstehguophbzyil-auth-token']);
    expect(hasPendingAuth(at('', ''))).toBe(true);
  });

  it('finds a session stored under a differently-derived key, rather than miss it', async () => {
    const { hasPendingAuth } = await load(['sb-someotherref-auth-token']);
    expect(hasPendingAuth(at('', ''))).toBe(true);
  });

  it('recognises every callback auth-js itself recognises', async () => {
    const { hasPendingAuth } = await load();
    // Implicit flow, which this app uses: the session or the error arrives in the fragment.
    expect(hasPendingAuth(at('', '#access_token=a&refresh_token=b&expires_in=3600&token_type=bearer'))).toBe(true);
    expect(hasPendingAuth(at('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'))).toBe(true);
    // auth-js merges query and fragment, so a callback in the query counts too.
    expect(hasPendingAuth(at('?error_description=expired', ''))).toBe(true);
    // PKCE.
    expect(hasPendingAuth(at('?code=abc123', ''))).toBe(true);
  });

  it('treats blocked storage as nothing stored, instead of throwing during first render', async () => {
    vi.stubGlobal('localStorage', {
      get length(): number {
        throw new Error('SecurityError');
      },
    });
    vi.resetModules();
    const { hasPendingAuth } = await import('./supabase');
    expect(() => hasPendingAuth(at('', ''))).not.toThrow();
    expect(hasPendingAuth(at('', ''))).toBe(false);
  });

  it('shares one client between every caller', async () => {
    const { loadSupabase } = await load();
    const [a, b] = await Promise.all([loadSupabase(), loadSupabase()]);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});

describe('without accounts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never reports pending auth, whatever is in the URL or storage', async () => {
    const { hasPendingAuth, accountsEnabled } = await load(['sb-anything-auth-token']);
    expect(accountsEnabled()).toBe(false);
    expect(hasPendingAuth(at('?code=x', '#access_token=y'))).toBe(false);
  });
});
