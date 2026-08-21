import type { DesignSystemOutput } from '../engine/types';

export interface WhySummary {
  sentence: string;
  /** Up to 3 short descriptors, drawn only from fields the engine already returned. */
  principles: string[];
}

/**
 * Builds the results-page "why this system" summary entirely from `output.reasoning` and
 * `output.style`/`output.category` — no new judgments, just a readable surface for data the
 * engine already produced. If fewer than 3 distinct descriptors exist in the output, fewer are
 * shown rather than padding with invented words.
 */
export function buildWhySummary(output: DesignSystemOutput): WhySummary {
  const colorMood = output.reasoning.colors.evidence?.mood?.trim();
  const typeMood = output.reasoning.typography.evidence?.mood?.trim();
  const styleName = output.style.name?.trim();
  const category = output.category?.trim();

  const seen = new Set<string>();
  const principles: string[] = [];
  for (const candidate of [colorMood, typeMood, styleName, category]) {
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    principles.push(candidate);
    if (principles.length === 3) break;
  }

  const moodPhrase = [colorMood, typeMood].filter(Boolean).join(' and ');
  const sentence = moodPhrase
    ? `This system leans on a ${moodPhrase.toLowerCase()} direction because the product matched "${category}".`
    : `This system was matched to "${category}", the closest of the engine's product categories for this query.`;

  return { sentence, principles };
}
