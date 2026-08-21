/**
 * Share links.
 *
 * A generated system is fully described by its input, so a link only has to carry ~61 bytes.
 * That means no backend, no stored rows, and no expiry: a shared link works forever because
 * the recipient's browser regenerates the system rather than fetching it.
 *
 * Readable query parameters rather than an encoded blob. `?p=fintech&k=mobile,trustworthy`
 * survives being read aloud, pasted into a chat that mangles long tokens, and edited by hand.
 * A base64 blob is shorter and completely opaque, which for a tool about explaining its
 * reasoning is the wrong trade.
 */

import type { GenerateInput } from '../engine/types';

export const SHARE_PATH = '/s';

const PARAM = {
  productType: 'p',
  industry: 'i',
  keywords: 'k',
  region: 'r',
} as const;

/** Query string for an input, omitting anything empty. */
export function encodeShareParams(input: GenerateInput): string {
  const params = new URLSearchParams();
  const product = input.productType?.trim();
  if (product) params.set(PARAM.productType, product);

  const industry = input.industry?.trim();
  if (industry) params.set(PARAM.industry, industry);

  const keywords = (input.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (keywords.length > 0) params.set(PARAM.keywords, keywords.join(','));

  const region = input.region?.trim();
  if (region) params.set(PARAM.region, region);

  return params.toString();
}

/** Absolute URL for sharing. Falls back to a relative path where there is no window. */
export function buildShareUrl(input: GenerateInput, origin?: string): string {
  const query = encodeShareParams(input);
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${SHARE_PATH}${query ? `?${query}` : ''}`;
}

/**
 * Read an input back out of a query string.
 *
 * Returns null when there is no usable product type — a share link without one cannot
 * generate anything, and guessing a default would silently hand the visitor a system that
 * has nothing to do with the link they followed.
 */
export function decodeShareParams(search: string): GenerateInput | null {
  const params = new URLSearchParams(search);
  const productType = params.get(PARAM.productType)?.trim();
  if (!productType) return null;

  const industry = params.get(PARAM.industry)?.trim();
  const region = params.get(PARAM.region)?.trim();
  const keywords = (params.get(PARAM.keywords) ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    productType,
    ...(industry ? { industry } : {}),
    keywords,
    ...(region ? { region } : {}),
  };
}
