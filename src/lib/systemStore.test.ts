// @vitest-environment jsdom

/**
 * Covers the storage port, the localStorage adapter, the legacy migration and share links.
 *
 * The migration matters most: it converts rows that stored a whole `DesignSystemOutput` into
 * rows that store only the input. Getting it wrong loses someone's saved work silently.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { generateDesignSystem } from '../engine';
import { ENGINE_VERSION, hashOutput, normalizeInput } from '../engine/version';
import { localSystemStore, migrateLegacySnapshots } from './localSystemStore';
import { buildShareUrl, decodeShareParams, encodeShareParams } from './shareLink';
import { detectDrift } from './systemStore';

const FP = { engineVersion: ENGINE_VERSION, outputHash: 'abc123' };

beforeEach(() => {
  localStorage.clear();
});

describe('engine fingerprint', () => {
  it('is stable for the same input', () => {
    const a = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    const b = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    expect(hashOutput(a)).toBe(hashOutput(b));
  });

  it('differs when the system differs', () => {
    const a = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    const b = generateDesignSystem({ productType: 'ecommerce', keywords: ['luxury'] });
    expect(hashOutput(a)).not.toBe(hashOutput(b));
  });

  it('normalises inputs so equivalent saves match', () => {
    expect(normalizeInput({ productType: '  fintech ', keywords: [' mobile ', '', 'x '] })).toEqual({
      productType: 'fintech',
      keywords: ['mobile', 'x'],
    });
  });

  it('drops blank optional fields rather than storing empty strings', () => {
    const n = normalizeInput({ productType: 'saas', keywords: [], industry: '  ', region: '' });
    expect('industry' in n).toBe(false);
    expect('region' in n).toBe(false);
  });
});

describe('local store', () => {
  it('saves and lists', async () => {
    await localSystemStore.save({ productType: 'fintech', keywords: ['mobile'] }, 'My system', FP);
    const rows = await localSystemStore.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('My system');
    expect(rows[0].input.productType).toBe('fintech');
  });

  it('stores the input, not the generated output', async () => {
    await localSystemStore.save({ productType: 'fintech', keywords: ['mobile'] }, 'x', FP);
    const raw = localStorage.getItem('basis-saved-systems')!;
    // The whole point: a saved row is tiny and carries no generated values.
    expect(raw.length).toBeLessThan(400);
    expect(raw).not.toContain('#');
    expect(raw).not.toContain('colors');
  });

  it('falls back to the product type when no name is given', async () => {
    const row = await localSystemStore.save({ productType: 'saas', keywords: [] }, '   ', FP);
    expect(row.name).toBe('saas');
  });

  it('renames and removes', async () => {
    const row = await localSystemStore.save({ productType: 'saas', keywords: [] }, 'a', FP);
    await localSystemStore.rename(row.id, 'b');
    expect((await localSystemStore.get(row.id))!.name).toBe('b');
    await localSystemStore.remove(row.id);
    expect(await localSystemStore.get(row.id)).toBeNull();
  });

  it('survives corrupt storage instead of throwing', async () => {
    localStorage.setItem('basis-saved-systems', '{not json');
    expect(await localSystemStore.list()).toEqual([]);
  });

  it('discards rows that are not saved systems', async () => {
    localStorage.setItem('basis-saved-systems', JSON.stringify([{ nonsense: true }]));
    expect(await localSystemStore.list()).toEqual([]);
  });
});

describe('legacy snapshot migration', () => {
  it('keeps the input and drops the stored output', async () => {
    const output = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    localStorage.setItem(
      'basis-versions',
      JSON.stringify([
        { id: 'old1', label: 'v0.1', savedAt: '2026-01-01T00:00:00.000Z', schemaVersion: 3, output },
      ]),
    );

    expect(migrateLegacySnapshots()).toBe(1);

    const rows = await localSystemStore.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('v0.1');
    expect(rows[0].input).toEqual(output.input);
    // Marked unknown rather than claiming to match the current engine.
    expect(rows[0].engineVersion).toBe('legacy');
  });

  it('clears the old key so it runs once', () => {
    const output = generateDesignSystem({ productType: 'saas', keywords: [] });
    localStorage.setItem('basis-versions', JSON.stringify([{ id: 'a', label: 'x', output }]));
    migrateLegacySnapshots();
    expect(localStorage.getItem('basis-versions')).toBeNull();
    expect(migrateLegacySnapshots()).toBe(0);
  });

  it('skips snapshots with no usable input rather than inventing one', () => {
    localStorage.setItem(
      'basis-versions',
      JSON.stringify([{ id: 'a', label: 'broken', output: { colors: {} } }]),
    );
    expect(migrateLegacySnapshots()).toBe(0);
  });

  it('does not duplicate a system already saved', async () => {
    const output = generateDesignSystem({ productType: 'fintech', keywords: ['mobile'] });
    await localSystemStore.save(output.input, 'already here', FP);
    localStorage.setItem('basis-versions', JSON.stringify([{ id: 'a', label: 'dup', output }]));

    migrateLegacySnapshots();

    expect(await localSystemStore.list()).toHaveLength(1);
  });

  it('does nothing when there is no legacy data', () => {
    expect(migrateLegacySnapshots()).toBe(0);
  });
});

describe('drift detection', () => {
  it('reports current while the engine version matches', () => {
    expect(detectDrift({ engineVersion: 'v1', outputHash: 'a' }, { engineVersion: 'v1', outputHash: 'b' })).toBe('current');
  });

  it('distinguishes an unaffected system from a changed one', () => {
    expect(detectDrift({ engineVersion: 'v1', outputHash: 'a' }, { engineVersion: 'v2', outputHash: 'a' })).toBe('unchanged');
    expect(detectDrift({ engineVersion: 'v1', outputHash: 'a' }, { engineVersion: 'v2', outputHash: 'z' })).toBe('changed');
  });
});

describe('share links', () => {
  it('round-trips an input', () => {
    const input = { productType: 'fintech', industry: 'payments', keywords: ['mobile', 'trustworthy'], region: 'Nigeria' };
    expect(decodeShareParams(encodeShareParams(input))).toEqual(input);
  });

  it('omits empty fields', () => {
    expect(encodeShareParams({ productType: 'saas', keywords: [] })).toBe('p=saas');
  });

  it('stays readable rather than encoding to a blob', () => {
    const q = encodeShareParams({ productType: 'fintech', keywords: ['mobile', 'trustworthy'] });
    expect(q).toBe('p=fintech&k=mobile%2Ctrustworthy');
    expect(decodeShareParams(q)!.keywords).toEqual(['mobile', 'trustworthy']);
  });

  it('returns null without a product type, instead of guessing', () => {
    expect(decodeShareParams('k=minimal')).toBeNull();
    expect(decodeShareParams('')).toBeNull();
  });

  it('survives a hand-edited link', () => {
    expect(decodeShareParams('p=saas&k=,,%20,')).toEqual({ productType: 'saas', keywords: [] });
  });

  it('builds an absolute url', () => {
    expect(buildShareUrl({ productType: 'saas', keywords: [] }, 'https://basis.app')).toBe(
      'https://basis.app/s?p=saas',
    );
  });

  it('regenerates the same system a share link promised', () => {
    const input = { productType: 'fintech', keywords: ['mobile', 'trustworthy'] };
    const original = generateDesignSystem(input);
    const fromLink = generateDesignSystem(decodeShareParams(encodeShareParams(input))!);
    expect(hashOutput(fromLink)).toBe(hashOutput(original));
  });
});
