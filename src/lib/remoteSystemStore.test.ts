// @vitest-environment jsdom

/**
 * The account store against a stubbed Supabase client.
 *
 * No network and no live project, so what is actually being tested is the contract: that the
 * remote store satisfies the same port as the local one, sets `user_id` itself, surfaces
 * errors instead of returning empty results, and that the upload path cannot duplicate rows.
 * Anything requiring a real database — RLS in particular — is verified in Postgres, not here.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRemoteSystemStore, uploadLocalSystems } from './remoteSystemStore';
import type { SavedSystem, SystemStore } from './systemStore';

const ROW = {
  id: 'row-1',
  name: 'My system',
  input: { productType: 'fintech', keywords: ['mobile'] },
  engine_version: '2026.08.20',
  output_hash: 'abc',
  created_at: '2026-08-20T00:00:00.000Z',
};

/** Minimal stand-in for the query builder, capturing what was sent. */
function stubClient(overrides: Record<string, unknown> = {}) {
  const captured: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data: [ROW], error: null })),
    eq: vi.fn((col: string, val: unknown) => {
      captured[`eq:${col}`] = val;
      return builder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve({ data: ROW, error: null })),
    single: vi.fn(() => Promise.resolve({ data: ROW, error: null })),
    insert: vi.fn((payload: unknown) => {
      captured.insert = payload;
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      captured.update = payload;
      return builder;
    }),
    delete: vi.fn(() => {
      captured.deleted = true;
      return builder;
    }),
    ...overrides,
  };
  const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
  return { client, captured, builder };
}

describe('remote store', () => {
  it('maps snake_case columns onto the port shape', async () => {
    const { client } = stubClient();
    const store = createRemoteSystemStore(client, 'user-1');

    const rows = await store.list();

    expect(rows[0]).toEqual({
      id: 'row-1',
      name: 'My system',
      input: { productType: 'fintech', keywords: ['mobile'] },
      engineVersion: '2026.08.20',
      outputHash: 'abc',
      createdAt: '2026-08-20T00:00:00.000Z',
    });
  });

  it('sets user_id from the session rather than trusting the caller', async () => {
    const { client, captured } = stubClient();
    const store = createRemoteSystemStore(client, 'user-1');

    await store.save({ productType: 'saas', keywords: [] }, 'x', {
      engineVersion: 'v1',
      outputHash: 'h',
    });

    expect((captured.insert as { user_id: string }).user_id).toBe('user-1');
  });

  it('stores the input only, never a generated system', async () => {
    const { client, captured } = stubClient();
    const store = createRemoteSystemStore(client, 'user-1');

    await store.save({ productType: 'saas', keywords: ['dark'] }, 'x', {
      engineVersion: 'v1',
      outputHash: 'h',
    });

    expect(Object.keys(captured.insert as object).sort()).toEqual([
      'engine_version',
      'input',
      'name',
      'output_hash',
      'user_id',
    ]);
  });

  it('falls back to the product type when the name is blank', async () => {
    const { client, captured } = stubClient();
    const store = createRemoteSystemStore(client, 'u');
    await store.save({ productType: 'saas', keywords: [] }, '   ', {
      engineVersion: 'v1',
      outputHash: 'h',
    });
    expect((captured.insert as { name: string }).name).toBe('saas');
  });

  it('throws on a database error instead of silently returning nothing', async () => {
    const { client } = stubClient({
      order: vi.fn(() => Promise.resolve({ data: null, error: { message: 'permission denied' } })),
    });
    const store = createRemoteSystemStore(client, 'u');

    await expect(store.list()).rejects.toThrow('permission denied');
  });

  it('ignores a blank rename rather than wiping the name', async () => {
    const { client, captured } = stubClient();
    const store = createRemoteSystemStore(client, 'u');
    await store.rename('row-1', '   ');
    expect(captured.update).toBeUndefined();
  });
});

describe('uploading local systems', () => {
  function fakeStore(initial: SavedSystem[] = []): SystemStore & { rows: SavedSystem[] } {
    const rows = [...initial];
    return {
      rows,
      async list() {
        return rows;
      },
      async get(id) {
        return rows.find((r) => r.id === id) ?? null;
      },
      async save(input, name, fp) {
        const row: SavedSystem = {
          id: `r${rows.length}`,
          name,
          input,
          engineVersion: fp.engineVersion,
          outputHash: fp.outputHash,
          createdAt: new Date().toISOString(),
        };
        rows.push(row);
        return row;
      },
      async rename() {},
      async remove() {},
    };
  }

  const local: SavedSystem[] = [
    {
      id: 'l1',
      name: 'One',
      input: { productType: 'fintech', keywords: ['mobile'] },
      engineVersion: 'v1',
      outputHash: 'a',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'l2',
      name: 'Two',
      input: { productType: 'saas', keywords: [] },
      engineVersion: 'v1',
      outputHash: 'b',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ];

  it('uploads everything into an empty account', async () => {
    const remote = fakeStore();
    expect(await uploadLocalSystems(remote, local)).toEqual({ uploaded: 2, skipped: 0 });
    expect(remote.rows).toHaveLength(2);
  });

  it('skips systems already in the account, matching on input', async () => {
    const remote = fakeStore([{ ...local[0], id: 'remote-1', name: 'different name' }]);

    // Same input under a different name is the same system, so it must not be duplicated.
    expect(await uploadLocalSystems(remote, local)).toEqual({ uploaded: 1, skipped: 1 });
    expect(remote.rows).toHaveLength(2);
  });

  it('is safe to run twice', async () => {
    const remote = fakeStore();
    await uploadLocalSystems(remote, local);
    expect(await uploadLocalSystems(remote, local)).toEqual({ uploaded: 0, skipped: 2 });
    expect(remote.rows).toHaveLength(2);
  });

  it('leaves local rows untouched so a failed upload loses nothing', async () => {
    const remote = fakeStore();
    const before = JSON.stringify(local);
    await uploadLocalSystems(remote, local);
    expect(JSON.stringify(local)).toBe(before);
  });
});

describe('unconfigured deployment', () => {
  it('exposes no client when the env vars are absent', async () => {
    // The test env sets neither VITE_SUPABASE_URL nor the anon key.
    const { supabase, accountsEnabled, accountsDisabledReason } = await import('./supabase');
    expect(supabase).toBeNull();
    expect(accountsEnabled()).toBe(false);
    expect(accountsDisabledReason).toMatch(/accounts are unavailable/i);
  });
});
