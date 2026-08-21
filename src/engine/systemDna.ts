/**
 * System DNA — the character of a generated system, in words.
 *
 * Every trait is evidenced: it fires only when a specific vocabulary appears in a specific
 * field the engine actually produced, and it reports which field and which words triggered
 * it. Nothing is scored, because nothing here is measurable — the engine has no notion of
 * "72% trustworthy", and inventing one would be the fake precision this product avoids.
 *
 * Two things ARE countable and are reported as counts, not vibes: how dark the palette is,
 * and how tight the spacing ramp is.
 */

import { isDarkBackground } from './semanticTokens';
import type { DesignSystemOutput } from './types';

export interface DnaTrait {
  /** The characteristic, as an adjective: "Trustworthy", "Restrained". */
  trait: string;
  /** Which engine field the evidence came from. */
  field: string;
  /** The exact words in that field that triggered it. */
  evidence: string;
}

export interface SystemDna {
  traits: DnaTrait[];
  /** One sentence describing the system's character, built from the traits found. */
  summary: string;
  /** Facts that are genuinely countable, shown as measurements rather than character. */
  measures: Array<{ label: string; value: string; note: string }>;
}

/**
 * Trait vocabulary. Each entry is a characteristic and the words that evidence it.
 * Kept deliberately small and specific — a long fuzzy list would fire on everything and
 * make every system sound the same.
 */
const TRAIT_VOCABULARY: Array<{ trait: string; words: string[] }> = [
  { trait: 'Trustworthy', words: ['trust', 'trustworthy', 'secure', 'security', 'banking', 'financial', 'professional', 'corporate', 'authority', 'reliable'] },
  { trait: 'Clear', words: ['clarity', 'readable', 'readability', 'legible', 'functional', 'scannable', 'hierarchy'] },
  { trait: 'Restrained', words: ['minimal', 'minimalism', 'subtle', 'restrained', 'understated', 'quiet'] },
  // "high contrast" deliberately absent: in these datasets it almost always describes WCAG
  // contrast, not visual energy, and it fired on accessibility-first styles.
  { trait: 'Energetic', words: ['vibrant', 'energetic', 'dynamic', 'loud', 'punchy', 'kinetic', 'maximalist'] },
  // "friendly" deliberately absent: it matched inside "screen reader friendly".
  { trait: 'Playful', words: ['playful', 'whimsical', 'cute', 'bubbly', 'bounce'] },
  { trait: 'Premium', words: ['luxury', 'premium', 'elegant', 'sophisticated', 'refined', 'editorial'] },
  { trait: 'Technical', words: ['technical', 'monospace', 'precise', 'engineering', 'developer', 'analytics'] },
  { trait: 'Dense', words: ['dense', 'compact', 'data-dense'] },
  { trait: 'Spacious', words: ['whitespace', 'airy', 'spacious'] },
  { trait: 'Accessible', words: ['accessible', 'accessibility', 'wcag', 'inclusive', 'legibility', 'screen reader'] },
  { trait: 'Modern', words: ['modern', 'contemporary', 'geometric', 'futuristic'] },
  { trait: 'Immersive', words: ['immersive', 'cinematic', 'storytelling', 'atmospheric', 'parallax'] },
];

/** Fields the vocabulary is matched against, most characteristic first. */
function evidenceFields(output: DesignSystemOutput): Array<{ field: string; text: string }> {
  return [
    { field: 'style.keywords', text: output.style.keywords },
    { field: 'style.name', text: output.style.name },
    { field: 'typography.mood', text: output.typography.mood },
    { field: 'colors.notes', text: output.colors.notes },
    { field: 'style.best_for', text: output.style.best_for },
    { field: 'style.accessibility', text: output.style.accessibility },
    { field: 'key_effects', text: output.key_effects },
  ];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word matching only.
 *
 * A plain substring test reads "friendly" out of "screen reader friendly" and calls an
 * accessibility style playful. Word boundaries stop that class of misread.
 */
function matchedWords(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`).test(lower));
}

export function buildSystemDna(output: DesignSystemOutput): SystemDna {
  const fields = evidenceFields(output);
  const traits: DnaTrait[] = [];

  /**
   * The category's own anti-patterns veto a trait. Fintech/Crypto records "Playful design"
   * as something to avoid, so describing a fintech system as playful contradicts the
   * engine's own guidance — regardless of what a keyword elsewhere happens to say.
   */
  const vetoed = (trait: string) =>
    matchedWords(output.anti_patterns ?? '', [trait.toLowerCase()]).length > 0;

  for (const { trait, words } of TRAIT_VOCABULARY) {
    if (vetoed(trait)) continue;
    for (const { field, text } of fields) {
      if (!text) continue;
      const hits = matchedWords(text, words);
      if (hits.length === 0) continue;
      traits.push({
        trait,
        field,
        // Quote the field, trimmed, so the reader sees the actual source text.
        evidence: text.length > 130 ? `${text.slice(0, 130).trimEnd()}…` : text,
      });
      break; // first (most characteristic) field wins; no double-counting
    }
  }

  const top = traits.slice(0, 5);
  const summary =
    top.length === 0
      ? 'The engine produced no descriptive keywords for this system, so its character cannot be summarised from the data.'
      : `This system reads as ${formatList(top.map((t) => t.trait.toLowerCase()))}, based on the style, typography and palette the engine selected for ${output.category}.`;

  return { traits: top, summary, measures: buildMeasures(output) };
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Countable facts. These are measurements, not character judgements. */
function buildMeasures(output: DesignSystemOutput): SystemDna['measures'] {
  const dark = isDarkBackground(output);
  const base = parseInt(output.spacing[1]?.px ?? '8', 10);
  const radius = parseInt(output.radius[0]?.value ?? '8', 10);

  return [
    {
      label: 'Ground',
      value: dark ? 'Dark' : 'Light',
      note: `Background ${output.colors.background} — measured by relative luminance.`,
    },
    {
      label: 'Spacing step',
      value: `${base}px`,
      note:
        output.provenance.tokens.spacing === 'style'
          ? `Derived from ${output.style.name}'s own declared density.`
          : 'Basis default step — this style declares no spacing.',
    },
    {
      label: 'Corner',
      value: `${radius}px`,
      note:
        output.provenance.tokens.radius === 'style'
          ? `${output.style.name} declares this radius.`
          : 'Basis default — this style declares no radius.',
    },
    {
      label: 'Motion',
      value: output.motion.duration,
      note:
        output.motion.source === 'style'
          ? `${output.style.name} declares this duration.`
          : 'Basis default duration.',
    },
  ];
}
