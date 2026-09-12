/**
 * Turns `provenance` into human-readable match strength, per decision.
 *
 * Deliberately label-based, never a percentage. The engine ranks with BM25, whose raw
 * scores are not normalised and are not comparable between domains, so any "87% confident"
 * figure would be invented precision. What IS real: whether anything matched at all, and
 * how far the winner led the runner-up. Those two facts produce the labels below.
 *
 * Nothing here feeds back into selection.
 */

import type { DesignSystemOutput, DomainProvenance, Provenance } from './types';

export type MatchLevel = 'strong' | 'good' | 'weak' | 'fallback';

export interface MatchAssessment {
  level: MatchLevel;
  label: string;
  /** Plain-language account of why it earned that label. */
  basis: string;
  /** True when no dataset row matched and a documented default was substituted. */
  isFallback: boolean;
}

export const MATCH_LABELS: Record<MatchLevel, string> = {
  strong: 'Strong match',
  good: 'Good match',
  weak: 'Weak match',
  fallback: 'Fallback used',
};

/** How far ahead the winner was. Ratios, because BM25 magnitudes are not meaningful alone. */
const CLEAR_LEAD = 1.5;
const SLIM_LEAD = 1.05;

function fromScores(p: DomainProvenance): MatchAssessment {
  if (!p.matched) {
    return {
      level: 'fallback',
      label: MATCH_LABELS.fallback,
      basis: 'No row in the dataset scored above zero for this query, so the documented default was used.',
      isFallback: true,
    };
  }

  const score = p.score ?? 0;
  const runnerUp = p.runnerUp ?? 0;

  if (runnerUp <= 0) {
    return {
      level: 'strong',
      label: MATCH_LABELS.strong,
      basis: 'One row matched the query and nothing else scored at all.',
      isFallback: false,
    };
  }

  const lead = score / runnerUp;
  if (lead >= CLEAR_LEAD) {
    return {
      level: 'strong',
      label: MATCH_LABELS.strong,
      basis: `The selected row outranked the next best by ${lead.toFixed(1)}×, so the choice was decisive.`,
      isFallback: false,
    };
  }
  if (lead >= SLIM_LEAD) {
    return {
      level: 'good',
      label: MATCH_LABELS.good,
      basis: `The selected row led the next best by ${lead.toFixed(2)}×. A clear winner, but not a wide one.`,
      isFallback: false,
    };
  }
  return {
    level: 'weak',
    label: MATCH_LABELS.weak,
    basis: 'The top two rows scored within a few percent of each other, so this was close to a coin toss.',
    isFallback: false,
  };
}

/**
 * The palette is judged by how it was selected, not by a score.
 *
 * It is read from the colours row named after the product category — the two files share
 * that key — so there is no ranking to report. Passing it through `fromScores` would have
 * said "one row matched the query and nothing else scored at all", which is not what
 * happened: nothing was searched.
 */
function colorAssessment(p: Provenance['colors']): MatchAssessment {
  if (!p.matched || p.path === 'none') {
    return {
      level: 'fallback',
      label: MATCH_LABELS.fallback,
      basis: 'No palette was available for this category, so the neutral defaults were used.',
      isFallback: true,
    };
  }
  if (p.path === 'category') {
    return {
      level: 'strong',
      label: MATCH_LABELS.strong,
      basis: 'colors.csv holds a palette for this exact product category, so it was used as it stands.',
      isFallback: false,
    };
  }
  return fromScores(p);
}

/**
 * Typography reports a refusal as a fallback, and says what was refused.
 *
 * A script-specific pairing that scored on an incidental word is not a match — it cannot
 * render the product's language. Saying only "no pairing matched" would hide that something
 * did score and was rejected for cause.
 */
function typographyAssessment(p: Provenance['typography']): MatchAssessment {
  if (!p.matched && p.excluded && p.excluded.length > 0) {
    return {
      level: 'fallback',
      label: MATCH_LABELS.fallback,
      basis: `Nothing in the description matched a pairing. ${p.excluded.length === 1 ? 'One pairing scored' : `${p.excluded.length} pairings scored`} on an incidental word but ${p.excluded.length === 1 ? 'is' : 'are'} built for another script (${p.excluded.join(', ')}), so the documented default was used instead.`,
      isFallback: true,
    };
  }
  return fromScores(p);
}

/** Style is judged by how it was selected, which says more than its search rank. */
function styleAssessment(p: Provenance['style']): MatchAssessment {
  if (!p.matched || p.path === 'none') {
    return {
      level: 'fallback',
      label: MATCH_LABELS.fallback,
      basis: 'No style matched the query, so the documented default was used.',
      isFallback: true,
    };
  }

  const priorities = p.priorities.join(' + ');

  switch (p.path) {
    case 'exact-match':
      return {
        level: 'strong',
        label: MATCH_LABELS.strong,
        basis: p.aliasedFrom
          ? `The product category asks for "${p.aliasedFrom}", which is corrected to "${p.matchedPriority}" — an exact style in the dataset, found among the search results.`
          : `The product category asks for ${priorities}, and "${p.matchedPriority}" is that style by name.`,
        isFallback: false,
      };
    case 'name-match':
      return {
        level: 'weak',
        label: MATCH_LABELS.weak,
        basis: `The category asks for ${priorities}, which names no style in the dataset. The closest partial name match was used.`,
        isFallback: false,
      };
    case 'keyword-score':
      return {
        level: 'good',
        label: MATCH_LABELS.good,
        basis: `No style name matched ${priorities}, so candidates were scored on keyword overlap and the highest scorer was taken.`,
        isFallback: false,
      };
    case 'top-ranked':
    default:
      return {
        level: 'good',
        label: MATCH_LABELS.good,
        basis: 'The category expressed no usable style preference, so the best search result was used.',
        isFallback: false,
      };
  }
}

export interface SystemMatchQuality {
  product: MatchAssessment;
  style: MatchAssessment;
  colors: MatchAssessment;
  typography: MatchAssessment;
  pattern: MatchAssessment;
  radius: MatchAssessment;
  spacing: MatchAssessment;
  motion: MatchAssessment;
}

function tokenAssessment(source: 'style' | 'default', what: string, styleName: string): MatchAssessment {
  return source === 'style'
    ? {
        level: 'strong',
        label: 'From the style',
        basis: `"${styleName}" declares its own ${what}, so that value is used directly.`,
        isFallback: false,
      }
    : {
        level: 'fallback',
        label: MATCH_LABELS.fallback,
        basis: `"${styleName}" declares no ${what}, so Basis used its documented default.`,
        isFallback: true,
      };
}

export function assessMatchQuality(output: DesignSystemOutput): SystemMatchQuality {
  const p = output.provenance;
  const styleName = output.style.name;
  return {
    product: fromScores(p.product),
    style: styleAssessment(p.style),
    colors: colorAssessment(p.colors),
    typography: typographyAssessment(p.typography),
    pattern: fromScores(p.pattern),
    radius: tokenAssessment(p.tokens.radius, 'corner radius', styleName),
    spacing: tokenAssessment(p.tokens.spacing, 'spacing density', styleName),
    motion: tokenAssessment(p.tokens.motion, 'transition duration', styleName),
  };
}

/** Every dimension that fell back, for an at-a-glance count. */
export function fallbackDimensions(output: DesignSystemOutput): string[] {
  const q = assessMatchQuality(output);
  return (Object.keys(q) as Array<keyof SystemMatchQuality>).filter((k) => q[k].isFallback);
}
