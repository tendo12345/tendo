import { generateDesignSystem } from '../engine';

/**
 * The one real, engine-generated system used across the marketing pages (hero preview, how-it-
 * works, what-you-get). Computed once via the actual `generateDesignSystem()` — never faked —
 * so every number and color shown before a visitor generates their own is real engine output.
 */
export const SAMPLE_SYSTEM = generateDesignSystem({
  productType: 'fintech mobile app',
  keywords: ['trustworthy', 'modern', 'minimal'],
});
