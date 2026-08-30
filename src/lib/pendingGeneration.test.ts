// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingGeneration,
  readPendingGeneration,
  storePendingGeneration,
} from './pendingGeneration';

/*
  The pending input is the only thing carrying a visitor's request across the sign-in redirect,
  so the cases that matter are the ones where it comes back wrong or not at all.

  It is read out of sessionStorage, which means it is untrusted input: a stale shape from an
  older release, or anything else that wrote to the key, would otherwise be handed straight to
  the engine.
*/

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('pendingGeneration', () => {
  it('returns null when nothing is stored', () => {
    expect(readPendingGeneration()).toBeNull();
  });

  it('round-trips a full input', () => {
    storePendingGeneration({
      productType: 'Fintech/Crypto',
      keywords: ['mobile', 'trustworthy'],
      industry: 'payments',
      region: 'Nigeria',
    });

    expect(readPendingGeneration()).toEqual({
      productType: 'Fintech/Crypto',
      keywords: ['mobile', 'trustworthy'],
      industry: 'payments',
      region: 'Nigeria',
    });
  });

  it('round-trips an input with only the required fields', () => {
    storePendingGeneration({ productType: 'SaaS (General)', keywords: [] });

    expect(readPendingGeneration()).toEqual({
      productType: 'SaaS (General)',
      keywords: [],
      industry: undefined,
      region: undefined,
    });
  });

  it('clears', () => {
    storePendingGeneration({ productType: 'Blog', keywords: [] });
    clearPendingGeneration();
    expect(readPendingGeneration()).toBeNull();
  });

  /*
    Everything below would reach generateDesignSystem if it were trusted. Rejecting outright is
    the right outcome: the cost is a re-typed form, where passing a malformed input to the engine
    is a crash on the page the visitor was redirected to.
  */
  it.each([
    ['not JSON at all', 'not json'],
    ['a JSON primitive', '"a string"'],
    ['null', 'null'],
    ['an object with no productType', '{"keywords":[]}'],
    ['an empty productType', '{"productType":"","keywords":[]}'],
    ['a non-string productType', '{"productType":42,"keywords":[]}'],
    ['keywords that are not an array', '{"productType":"Blog","keywords":"mobile"}'],
  ])('rejects %s', (_label, raw) => {
    sessionStorage.setItem('dsg-pending-generation', raw);
    expect(readPendingGeneration()).toBeNull();
  });

  it('drops non-string entries from keywords rather than passing them through', () => {
    sessionStorage.setItem(
      'dsg-pending-generation',
      '{"productType":"Blog","keywords":["mobile",7,null,"clean"]}',
    );

    expect(readPendingGeneration()?.keywords).toEqual(['mobile', 'clean']);
  });

  it('survives storage that throws, because private browsing is not an error state', () => {
    // Losing the pending input costs a re-typed form. Throwing costs the page the visitor was
    // redirected to, which is worse than the thing being unavailable.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => storePendingGeneration({ productType: 'Blog', keywords: [] })).not.toThrow();
    expect(readPendingGeneration()).toBeNull();
  });
});
