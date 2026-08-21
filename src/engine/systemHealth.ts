/**
 * System health.
 *
 * Every area is scored from something countable — contrast ratios that pass, tokens that
 * came from the dataset rather than a default, states that stay legible. Nothing is
 * assigned a number for the sake of having one, and each area reports the count behind its
 * rating so the reader can check the work.
 */

import { auditAccessibility } from './accessibility';
import { stateContrastReport } from './componentStates';
import { fallbackDimensions } from './matchQuality';
import { buildSemanticTokens } from './semanticTokens';
import type { DesignSystemOutput } from './types';

export type HealthRating = 'strong' | 'good' | 'attention';

export interface HealthArea {
  area: 'Color' | 'Typography' | 'Token coverage' | 'Component states' | 'Accessibility' | 'Consistency';
  rating: HealthRating;
  /** The measurement behind the rating. */
  measure: string;
  /** What would move it up, when there is something to do. */
  improve?: string;
}

export interface SystemHealth {
  areas: HealthArea[];
  /** Areas needing attention, so the summary can lead with the weakness. */
  weakest: HealthArea[];
}

const RATING_ORDER: Record<HealthRating, number> = { attention: 0, good: 1, strong: 2 };

export function assessSystemHealth(output: DesignSystemOutput): SystemHealth {
  const audit = auditAccessibility(output);
  const tokens = buildSemanticTokens(output);
  const states = stateContrastReport(output);
  const fallbacks = fallbackDimensions(output);

  /* ---- colour: how many checked pairs pass ---- */
  const passingPairs = audit.contrastPairs.filter((p) => p.status === 'pass').length;
  const totalPairs = audit.contrastPairs.length;
  const colorRatio = passingPairs / totalPairs;

  /* ---- token coverage: how much came from the dataset vs a default ---- */
  const generated = tokens.filter((t) => t.origin === 'generated').length;
  const coverage = generated / tokens.length;

  /* ---- component states: how many stay legible ---- */
  const okStates = states.filter((s) => s.ok).length;
  const stateRatio = okStates / states.length;

  const areas: HealthArea[] = [
    {
      area: 'Color',
      rating: colorRatio === 1 ? 'strong' : colorRatio >= 0.75 ? 'good' : 'attention',
      measure: `${passingPairs} of ${totalPairs} contrast pairs meet their WCAG target.`,
      improve:
        colorRatio === 1
          ? undefined
          : 'Adjust the failing foreground or surface colours in the Accessibility section.',
    },
    {
      area: 'Typography',
      rating: output.provenance.typography.matched ? 'strong' : 'attention',
      measure: output.provenance.typography.matched
        ? `Pairing selected from the dataset: ${output.typography.heading} with ${output.typography.body}.`
        : 'No pairing matched, so Inter was substituted for both roles.',
      improve: output.provenance.typography.matched
        ? undefined
        : 'Add a style keyword that describes the tone you want, so the typography search has something to match.',
    },
    {
      area: 'Token coverage',
      rating: coverage >= 0.6 ? 'strong' : coverage >= 0.35 ? 'good' : 'attention',
      measure: `${generated} of ${tokens.length} tokens come from the dataset; the rest are derived or Basis defaults.`,
      improve:
        coverage >= 0.6
          ? undefined
          : 'Most gaps come from the matched style declaring no radius, spacing or motion. A more specific style keyword usually lands on a style that does.',
    },
    {
      area: 'Component states',
      rating: stateRatio === 1 ? 'strong' : stateRatio >= 0.8 ? 'good' : 'attention',
      measure: `${okStates} of ${states.length} component states keep a legible contrast ratio.`,
      improve:
        stateRatio === 1
          ? undefined
          : 'The failing states are usually disabled variants blended too far into the background.',
    },
    {
      area: 'Accessibility',
      rating:
        audit.counts.attention > 0 ? 'attention' : audit.counts.warning > 0 ? 'good' : 'strong',
      measure: `${audit.counts.pass} checks pass, ${audit.counts.warning} warn, ${audit.counts.attention} need attention.`,
      improve: audit.counts.pass === audit.findings.length ? undefined : 'See the Accessibility section for each finding and its fix.',
    },
    {
      area: 'Consistency',
      rating: fallbacks.length === 0 ? 'strong' : fallbacks.length <= 3 ? 'good' : 'attention',
      measure:
        fallbacks.length === 0
          ? 'Every dimension was matched from the dataset.'
          : `${fallbacks.length} dimensions fell back to a default: ${fallbacks.join(', ')}.`,
      improve:
        fallbacks.length === 0
          ? undefined
          : 'Fallbacks are documented defaults, not errors — but a system built mostly from defaults is not really tailored to your product.',
    },
  ];

  const weakest = [...areas]
    .filter((a) => a.rating !== 'strong')
    .sort((a, b) => RATING_ORDER[a.rating] - RATING_ORDER[b.rating]);

  return { areas, weakest };
}
