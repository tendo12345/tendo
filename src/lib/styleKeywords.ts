import stylesData from '../data/styles.json';
import type { Row } from '../engine/types';

const styles = stylesData as Row[];

/** The spec's curated starting list, shown first regardless of frequency in the data. */
const CURATED = [
  'Minimal',
  'Modern',
  'Premium',
  'Playful',
  'Professional',
  'Editorial',
  'Bold',
  'Friendly',
  'Technical',
  'Luxury',
  'Futuristic',
  'Calm',
  'Dark',
  'Clean',
];

function titleCase(word: string): string {
  return word.length ? word[0].toUpperCase() + word.slice(1) : word;
}

/**
 * Style-keyword chips for the Generator page: the spec's curated words, extended with short,
 * frequently-occurring tags pulled straight from `styles.csv`'s own `Keywords` column so the
 * suggestions stay grounded in what the engine actually recognizes. Custom free text is always
 * still allowed — this only affects which chips are offered up front.
 */
export function getSuggestedKeywords(limit = 20): string[] {
  const counts = new Map<string, number>();
  for (const style of styles) {
    const raw = style['Keywords'] ?? '';
    for (const tag of raw.split(',')) {
      const trimmed = tag.trim();
      if (!trimmed || trimmed.includes(' ') || trimmed.length > 14) continue;
      const key = trimmed.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const dataKeywords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => titleCase(word));

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const word of [...CURATED, ...dataKeywords]) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(word);
    if (merged.length === limit) break;
  }
  return merged;
}
