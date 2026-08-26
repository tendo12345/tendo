import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  `authProviders` reads the project URL and key from `lib/supabase`, which builds them from
  `import.meta.env` at module load. Stub that module rather than the environment so these
  cases do not depend on whether the machine running them has a Supabase project configured.
*/
vi.mock('./supabase', () => ({
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'test-anon-key',
}));

const { enabledOAuthProviders, resetProviderCacheForTests } = await import('./authProviders');

function settings(external: Record<string, boolean>) {
  return { ok: true, json: async () => ({ external }) } as Response;
}

beforeEach(() => {
  resetProviderCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enabledOAuthProviders', () => {
  it('offers only the providers the project has turned on', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settings({ google: true, github: false })));

    expect(await enabledOAuthProviders()).toEqual(['google']);
  });

  it('offers none when every provider is off — the live state that motivated this', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settings({ google: false, github: false, email: true })));

    expect(await enabledOAuthProviders()).toEqual([]);
  });

  it('never offers a provider Basis has no sign-in code for', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settings({ google: true, notion: true, apple: true })));

    expect(await enabledOAuthProviders()).toEqual(['google']);
  });

  /*
    The three ways the lookup can fail all collapse to the same answer: show nothing.

    A button we cannot confirm works is the exact failure this module removes, so a broken
    endpoint must look identical to a disabled provider rather than optimistically rendering.
  */
  it('fails closed when the endpoint errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));

    expect(await enabledOAuthProviders()).toEqual([]);
  });

  it('fails closed when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));

    expect(await enabledOAuthProviders()).toEqual([]);
  });

  it('fails closed when the payload has no external block', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response));

    expect(await enabledOAuthProviders()).toEqual([]);
  });

  it('asks the project once and reuses the answer', async () => {
    const spy = vi.fn(async () => settings({ github: true }));
    vi.stubGlobal('fetch', spy);

    await enabledOAuthProviders();
    await enabledOAuthProviders();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
