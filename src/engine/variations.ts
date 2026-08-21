/**
 * Design direction variations.
 *
 * A variation is not a filter applied to a finished system — it is a genuine re-run of the
 * engine with additional style keywords appended to the query. That keeps the one reasoning
 * path: whatever comes back was selected by the same BM25 search and the same priority
 * rules as the original.
 *
 * Consequences worth being honest about, and which `describeOutcome` reports:
 *   - a direction can change nothing, when the added keywords do not move the ranking
 *   - a direction can change the product category, if the keywords are strong enough
 * Neither is hidden. Pretending every request produced a meaningful shift would be the
 * fake intelligence this product exists to avoid.
 */

import { generateDesignSystem } from './designSystem';
import type { DesignSystemOutput, GenerateInput } from './types';

export type DirectionId =
  | 'minimal'
  | 'premium'
  | 'playful'
  | 'technical'
  | 'editorial'
  | 'energetic'
  | 'accessible'
  | 'restrained';

export interface Direction {
  id: DirectionId;
  label: string;
  /** Keywords appended to the original query. These are real search terms in styles.csv. */
  keywords: string[];
  description: string;
}

export const DIRECTIONS: Direction[] = [
  { id: 'minimal', label: 'More minimal', keywords: ['minimal', 'clean'], description: 'Pushes toward restraint and whitespace.' },
  { id: 'premium', label: 'More premium', keywords: ['luxury', 'elegant'], description: 'Pushes toward refinement and editorial polish.' },
  { id: 'playful', label: 'More playful', keywords: ['playful', 'friendly'], description: 'Pushes toward warmth and softer shapes.' },
  { id: 'technical', label: 'More technical', keywords: ['technical', 'data'], description: 'Pushes toward density and precision.' },
  { id: 'editorial', label: 'More editorial', keywords: ['editorial', 'typography'], description: 'Pushes toward type-led layouts.' },
  { id: 'energetic', label: 'More energetic', keywords: ['vibrant', 'bold'], description: 'Pushes toward higher contrast and stronger colour.' },
  { id: 'accessible', label: 'More accessible', keywords: ['accessible', 'inclusive'], description: 'Pushes toward legibility and WCAG-first styles.' },
  { id: 'restrained', label: 'More restrained', keywords: ['subtle', 'understated'], description: 'Pushes toward quieter treatment.' },
];

export interface VariationChange {
  field: string;
  before: string;
  after: string;
}

export interface Variation {
  id: string;
  direction: Direction;
  input: GenerateInput;
  output: DesignSystemOutput;
  changes: VariationChange[];
  /** Plain statement of what the re-run actually did. */
  outcome: string;
  /** True when the engine returned an identical system. */
  unchanged: boolean;
}

function diff(before: DesignSystemOutput, after: DesignSystemOutput): VariationChange[] {
  const fields: Array<[string, (o: DesignSystemOutput) => string]> = [
    ['Product category', (o) => o.category],
    ['Design direction', (o) => o.style.name],
    ['Primary', (o) => o.colors.primary],
    ['Accent', (o) => o.colors.accent],
    ['Background', (o) => o.colors.background],
    ['Heading font', (o) => o.typography.heading],
    ['Body font', (o) => o.typography.body],
    ['Layout pattern', (o) => o.pattern.name],
    ['Corner radius', (o) => o.radius[0]?.value ?? ''],
    ['Spacing step', (o) => o.spacing[1]?.px ?? ''],
    ['Motion', (o) => o.motion.duration],
  ];

  return fields
    .map(([field, get]) => ({ field, before: get(before), after: get(after) }))
    .filter((c) => c.before !== c.after);
}

function describeOutcome(direction: Direction, changes: VariationChange[], categoryChanged: boolean): string {
  if (changes.length === 0) {
    return `"${direction.label}" changed nothing. The added keywords (${direction.keywords.join(', ')}) did not outrank anything in the original search, so the engine returned the same system. That is a real answer, not a failure: this product's data does not support that direction.`;
  }
  if (categoryChanged) {
    return `"${direction.label}" changed ${changes.length} ${changes.length === 1 ? 'value' : 'values'} — including the product category, because the added keywords were strong enough to match a different product type. The system is no longer describing the same product, so treat it as a different starting point rather than a restyle.`;
  }
  return `"${direction.label}" changed ${changes.length} ${changes.length === 1 ? 'value' : 'values'}. The product category held, so this is the same product read through a different style lens.`;
}

/** Re-run the engine with a direction's keywords appended to the original input. */
export function createVariation(base: DesignSystemOutput, direction: Direction): Variation {
  const input: GenerateInput = {
    ...base.input,
    keywords: [...(base.input.keywords ?? []), ...direction.keywords],
  };
  const output = generateDesignSystem(input);
  const changes = diff(base, output);
  const categoryChanged = changes.some((c) => c.field === 'Product category');

  return {
    id: `${direction.id}-${output.query.replace(/\s+/g, '-')}`,
    direction,
    input,
    output,
    changes,
    outcome: describeOutcome(direction, changes, categoryChanged),
    unchanged: changes.length === 0,
  };
}

export interface ComparisonRow {
  field: string;
  a: string;
  b: string;
  same: boolean;
}

/** Side-by-side comparison of any two systems. */
export function compareSystems(a: DesignSystemOutput, b: DesignSystemOutput): ComparisonRow[] {
  const fields: Array<[string, (o: DesignSystemOutput) => string]> = [
    ['Query', (o) => o.query],
    ['Product category', (o) => o.category],
    ['Design direction', (o) => o.style.name],
    ['Primary', (o) => o.colors.primary],
    ['Secondary', (o) => o.colors.secondary],
    ['Accent', (o) => o.colors.accent],
    ['Background', (o) => o.colors.background],
    ['Foreground', (o) => o.colors.foreground],
    ['Heading font', (o) => o.typography.heading],
    ['Body font', (o) => o.typography.body],
    ['Layout pattern', (o) => o.pattern.name],
    ['Spacing step', (o) => o.spacing[1]?.px ?? ''],
    ['Corner radius', (o) => o.radius[0]?.value ?? ''],
    ['Motion', (o) => o.motion.duration],
    ['Severity', (o) => o.severity],
    ['Anti-patterns', (o) => o.anti_patterns || '—'],
  ];

  return fields.map(([field, get]) => {
    const av = get(a);
    const bv = get(b);
    return { field, a: av, b: bv, same: av === bv };
  });
}
