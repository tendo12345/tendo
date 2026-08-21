/**
 * Design system generation, ported from `scripts/design_system.py` (commit 7538cfb).
 *
 * `generateDesignSystem()` is a pure function: same input, same output, no I/O, no React.
 * The selection logic is a faithful mirror of the Python, including its quirks, which are
 * called out in comments where they surprise. The `reasoning` block is additive: it explains
 * choices the Python makes silently, without changing any of them.
 */

import { COLOR_FALLBACKS, DEFAULT_REASONING, SHADOW_SCALE } from './constants';
import { search } from './search';
import { normalizeStylePriority } from './stylePriority';
import { buildGround } from './ground';
import { deriveStyleTokens } from './styleTokens';
import type {
  DomainProvenance,
  Provenance,
  DesignSystemOutput,
  Domain,
  GenerateInput,
  PythonParityOutput,
  Reasoning,
  Row,
} from './types';

import reasoningData from '../data/ui-reasoning.json';

/** Mirrors SEARCH_CONFIG. Order matters: it is the order the Python iterates domains in. */
const SEARCH_CONFIG: Array<[Domain, number]> = [
  ['product', 1],
  ['style', 3],
  ['color', 2],
  ['landing', 2],
  ['typography', 2],
];

interface AppliedReasoning {
  pattern: string;
  style_priority: string[];
  color_mood: string;
  typography_mood: string;
  key_effects: string;
  anti_patterns: string;
  decision_rules: Record<string, string>;
  severity: string;
  /** Not in the Python: which reasoning row matched, so the "why" can cite it. */
  matched_category: string | null;
  match_kind: 'exact' | 'partial' | 'keyword' | 'none';
}

const RULES = reasoningData as Row[];

/**
 * Find the reasoning row for a product category. Three passes, in the Python's order:
 * exact match, then substring either way, then any word of the rule's category appearing
 * in the product category.
 */
function findReasoningRule(category: string): {
  rule: Row | null;
  kind: AppliedReasoning['match_kind'];
} {
  const categoryLower = category.toLowerCase();

  for (const rule of RULES) {
    if ((rule['UI_Category'] ?? '').toLowerCase() === categoryLower) {
      return { rule, kind: 'exact' };
    }
  }

  for (const rule of RULES) {
    const uiCat = (rule['UI_Category'] ?? '').toLowerCase();
    if (uiCat.includes(categoryLower) || categoryLower.includes(uiCat)) {
      return { rule, kind: 'partial' };
    }
  }

  for (const rule of RULES) {
    const uiCat = (rule['UI_Category'] ?? '').toLowerCase();
    const keywords = uiCat.replace(/\//g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
    if (keywords.some((kw) => categoryLower.includes(kw))) {
      return { rule, kind: 'keyword' };
    }
  }

  return { rule: null, kind: 'none' };
}

function applyReasoning(category: string): AppliedReasoning {
  const { rule, kind } = findReasoningRule(category);

  if (!rule) {
    return { ...DEFAULT_REASONING, matched_category: null, match_kind: 'none' };
  }

  let decisionRules: Record<string, string> = {};
  try {
    decisionRules = JSON.parse(rule['Decision_Rules'] || '{}');
  } catch {
    // Python swallows JSONDecodeError and keeps the empty dict.
  }

  return {
    pattern: rule['Recommended_Pattern'] ?? '',
    // Python splits on "+" and strips. An empty cell yields [''], not [], and that empty
    // string later matches every style name, degrading selection to "first result".
    style_priority: (rule['Style_Priority'] ?? '').split('+').map((s) => s.trim()),
    color_mood: rule['Color_Mood'] ?? '',
    typography_mood: rule['Typography_Mood'] ?? '',
    key_effects: rule['Key_Effects'] ?? '',
    anti_patterns: rule['Anti_Patterns'] ?? '',
    decision_rules: decisionRules,
    severity: rule['Severity'] ?? 'MEDIUM',
    matched_category: rule['UI_Category'] ?? '',
    match_kind: kind,
  };
}

interface StyleSelection {
  row: Row;
  how: 'exact-match' | 'name-match' | 'keyword-score' | 'top-ranked' | 'none';
  matchedPriority?: string;
  /** Set when an alias corrected the priority before matching. */
  aliasedFrom?: string;
  score?: number;
}

/**
 * Pick a style from the BM25 results using the reasoning row's Style_Priority.
 *
 * Diverges from the Python deliberately (see PORTING-NOTES.md). The source ran a two-way
 * substring test first, so the priority "Minimalism" matched the row "Exaggerated
 * Minimalism" and "Neumorphism" matched "Neumorphism (Mobile)", overriding better-ranked
 * results on 58 of 161 product types. Here priorities are first corrected through the
 * alias table, then matched exactly; substring matching survives only as a third pass for
 * the handful of priorities that name a style the dataset does not contain.
 */
function selectBestMatch(results: Row[], priorityKeywords: string[]): StyleSelection {
  if (results.length === 0) return { row: {}, how: 'none' };
  if (priorityKeywords.length === 0) return { row: results[0], how: 'top-ranked' };

  // An empty priority (from an empty Style_Priority cell) means "no preference".
  const priorities = priorityKeywords.map((p) => p.trim()).filter((p) => p.length > 0);
  if (priorities.length === 0) return { row: results[0], how: 'top-ranked' };

  // Pass 1: exact match on the corrected style name.
  for (const priority of priorities) {
    const normalized = normalizeStylePriority(priority);
    const target = normalized.toLowerCase();
    for (const result of results) {
      if ((result['Style Category'] ?? '').toLowerCase() === target) {
        return {
          row: result,
          how: 'exact-match',
          matchedPriority: normalized,
          ...(normalized !== priority ? { aliasedFrom: priority } : {}),
        };
      }
    }
  }

  // Pass 2: substring, for priorities naming a style that is not in the dataset.
  for (const priority of priorities) {
    const priorityLower = normalizeStylePriority(priority).toLowerCase();
    for (const result of results) {
      const styleName = (result['Style Category'] ?? '').toLowerCase();
      if (styleName.includes(priorityLower) || priorityLower.includes(styleName)) {
        return { row: result, how: 'name-match', matchedPriority: priority };
      }
    }
  }

  const scored: Array<{ score: number; result: Row }> = results.map((result) => {
    const resultStr = JSON.stringify(result).toLowerCase();
    let score = 0;
    for (const kw of priorityKeywords) {
      const kwLower = kw.toLowerCase().trim();
      if ((result['Style Category'] ?? '').toLowerCase().includes(kwLower)) {
        score += 10;
      } else if ((result['Keywords'] ?? '').toLowerCase().includes(kwLower)) {
        score += 3;
      } else if (resultStr.includes(kwLower)) {
        score += 1;
      }
    }
    return { score, result };
  });

  // Stable sort on score alone, matching Python's sort(key=lambda x: x[0], reverse=True).
  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score > 0) {
    return { row: scored[0].result, how: 'keyword-score', score: scored[0].score };
  }
  return { row: results[0], how: 'top-ranked' };
}

/** Build the single query string the Python CLI would have been given. */
export function buildQuery(input: GenerateInput): string {
  return [input.productType, input.industry, ...(input.keywords ?? [])]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ');
}

function reason(
  decision: string,
  why: string,
  source: string,
  evidence?: Record<string, string>,
): Reasoning {
  return { decision, why, source, ...(evidence ? { evidence } : {}) };
}

/**
 * Generate a design system.
 *
 * Steps mirror `DesignSystemGenerator.generate()`:
 *   1. search products for the category
 *   2. look up that category's reasoning row
 *   3. search the remaining domains, biasing the style query with Style_Priority
 *   4. pick the best row per domain
 *   5. assemble
 */
export function generateDesignSystem(input: GenerateInput): DesignSystemOutput {
  const query = buildQuery(input);

  // Step 1: product category.
  const productResult = search(query, 'product', 1);
  const category = productResult.results[0]?.['Product Type'] || 'General';

  // Step 2: reasoning rules for that category.
  const reasoning = applyReasoning(category);
  const stylePriority = reasoning.style_priority;

  // Step 3: multi-domain search. Style gets the priority keywords appended to the query.
  const priorityQuery = stylePriority.length > 0 ? stylePriority.slice(0, 2).join(' ') : query;
  const styleQuery = `${query} ${priorityQuery}`;

  const searchResults: Partial<Record<Domain, Row[]>> = {};
  const searchMeta: Partial<Record<Domain, { score?: number; runnerUp?: number }>> = {};
  for (const [domain, maxResults] of SEARCH_CONFIG) {
    const q = domain === 'style' ? styleQuery : query;
    const res = search(q, domain, maxResults);
    searchResults[domain] = res.results;
    searchMeta[domain] = { score: res.scores?.[0], runnerUp: res.runnerUpScore };
  }
  searchResults.product = productResult.results;
  searchMeta.product = { score: productResult.scores?.[0], runnerUp: productResult.runnerUpScore };

  // Step 4: best match per domain. Only style consults the priority list; the rest take
  // the top BM25 hit.
  const styleResults = searchResults.style ?? [];
  const colorResults = searchResults.color ?? [];
  const typographyResults = searchResults.typography ?? [];
  const landingResults = searchResults.landing ?? [];

  const styleSelection = selectBestMatch(styleResults, stylePriority);
  const bestStyle = styleSelection.row;
  const bestColor = colorResults[0] ?? {};
  const bestTypography = typographyResults[0] ?? {};
  const bestLanding = landingResults[0] ?? {};

  // Step 5: assemble. Style effects win over the reasoning row's effects when present.
  const styleEffects = bestStyle['Effects & Animation'] ?? '';
  const combinedEffects = styleEffects ? styleEffects : reasoning.key_effects;

  const parity: PythonParityOutput = {
    project_name: query.toUpperCase(),
    category,
    pattern: {
      name: bestLanding['Pattern Name'] ?? reasoning.pattern ?? 'Hero + Features + CTA',
      sections: bestLanding['Section Order'] ?? 'Hero > Features > CTA',
      cta_placement: bestLanding['Primary CTA Placement'] ?? 'Above fold',
      color_strategy: bestLanding['Color Strategy'] ?? '',
      conversion: bestLanding['Conversion Optimization'] ?? '',
    },
    style: {
      name: bestStyle['Style Category'] ?? 'Minimalism',
      type: bestStyle['Type'] ?? 'General',
      effects: styleEffects,
      keywords: bestStyle['Keywords'] ?? '',
      best_for: bestStyle['Best For'] ?? '',
      performance: bestStyle['Performance'] ?? '',
      accessibility: bestStyle['Accessibility'] ?? '',
      light_mode: bestStyle['Light Mode ✓'] ?? '',
      dark_mode: bestStyle['Dark Mode ✓'] ?? '',
    },
    colors: {
      primary: bestColor['Primary'] ?? COLOR_FALLBACKS.primary,
      on_primary: bestColor['On Primary'] ?? '',
      secondary: bestColor['Secondary'] ?? COLOR_FALLBACKS.secondary,
      accent: bestColor['Accent'] ?? COLOR_FALLBACKS.accent,
      background: bestColor['Background'] ?? COLOR_FALLBACKS.background,
      foreground: bestColor['Foreground'] ?? COLOR_FALLBACKS.foreground,
      muted: bestColor['Muted'] ?? '',
      border: bestColor['Border'] ?? '',
      destructive: bestColor['Destructive'] ?? '',
      ring: bestColor['Ring'] ?? '',
      notes: bestColor['Notes'] ?? '',
      cta: bestColor['Accent'] ?? COLOR_FALLBACKS.accent,
      text: bestColor['Foreground'] ?? COLOR_FALLBACKS.foreground,
    },
    typography: {
      heading: bestTypography['Heading Font'] ?? 'Inter',
      body: bestTypography['Body Font'] ?? 'Inter',
      mood: bestTypography['Mood/Style Keywords'] ?? reasoning.typography_mood,
      best_for: bestTypography['Best For'] ?? '',
      google_fonts_url: bestTypography['Google Fonts URL'] ?? '',
      css_import: bestTypography['CSS Import'] ?? '',
    },
    key_effects: combinedEffects,
    anti_patterns: reasoning.anti_patterns,
    decision_rules: reasoning.decision_rules,
    severity: reasoning.severity,
  };

  const styleWhy = (() => {
    switch (styleSelection.how) {
      case 'exact-match':
        return `"${reasoning.matched_category ?? category}" prioritises ${stylePriority.join(' + ')}, and "${parity.style.name}" is that style by name${
          styleSelection.aliasedFrom
            ? ` (the reasoning data writes it as "${styleSelection.aliasedFrom}", which is not a style in the dataset; it is corrected to "${styleSelection.matchedPriority}")`
            : ''
        }. It was taken ahead of the raw search ranking.`;
      case 'name-match':
        return `"${reasoning.matched_category ?? category}" prioritises ${stylePriority.join(' + ')}, which names no style in the dataset. "${parity.style.name}" was the closest partial match among the top-ranked styles.`;
      case 'keyword-score':
        return `No style name matched the priority list (${stylePriority.join(' + ')}), so styles were scored on keyword overlap: 10 points for a name hit, 3 for a keyword hit, 1 elsewhere. "${parity.style.name}" scored highest at ${styleSelection.score}.`;
      case 'top-ranked':
        return `The reasoning row gave no usable style priority, so the top-ranked style for the query was used.`;
      default:
        return `No style matched the query, so the default was used.`;
    }
  })();

  const tokens = deriveStyleTokens(bestStyle);

  const domainProvenance = (domain: Domain, matched: boolean): DomainProvenance => ({
    matched,
    ...(searchMeta[domain]?.score !== undefined ? { score: searchMeta[domain]!.score } : {}),
    ...(searchMeta[domain]?.runnerUp !== undefined ? { runnerUp: searchMeta[domain]!.runnerUp } : {}),
  });

  const provenance: Provenance = {
    product: domainProvenance('product', productResult.results.length > 0),
    colors: domainProvenance('color', colorResults.length > 0),
    typography: domainProvenance('typography', typographyResults.length > 0),
    pattern: domainProvenance('landing', landingResults.length > 0),
    style: {
      ...domainProvenance('style', styleResults.length > 0),
      path: styleSelection.how,
      ...(styleSelection.matchedPriority ? { matchedPriority: styleSelection.matchedPriority } : {}),
      ...(styleSelection.aliasedFrom ? { aliasedFrom: styleSelection.aliasedFrom } : {}),
      priorities: stylePriority.filter((p) => p.length > 0),
    },
    reasoningRule: { category: reasoning.matched_category, matchKind: reasoning.match_kind },
    tokens: {
      radius: tokens.radiusSource,
      spacing: tokens.spacingSource,
      motion: tokens.motion.source,
    },
  };

  return {
    ...parity,
    input,
    query,
    provenance,
    ground: buildGround({ ...parity, input, query, spacing: tokens.spacing, radius: tokens.radius, shadows: SHADOW_SCALE, components: tokens.components, motion: tokens.motion, provenance, reasoning: {} } as never),
    spacing: tokens.spacing,
    radius: tokens.radius,
    shadows: SHADOW_SCALE,
    components: tokens.components,
    motion: tokens.motion,
    reasoning: {
      category: reason(
        category,
        reasoning.match_kind === 'none'
          ? `No reasoning row matched "${category}", so the generic defaults were applied.`
          : `The query ranked "${category}" as the closest of 161 product types, and its reasoning row matched by ${reasoning.match_kind} on "${reasoning.matched_category}".`,
        'products.csv + ui-reasoning.csv',
        { severity: reasoning.severity },
      ),
      pattern: reason(
        parity.pattern.name,
        landingResults.length > 0
          ? `"${parity.pattern.name}" was the top-ranked landing pattern for this query. Its section order and CTA placement come with it.`
          : `No landing pattern matched, so the reasoning row's recommended pattern ("${reasoning.pattern}") was used.`,
        'landing.csv',
        { sections: parity.pattern.sections, cta: parity.pattern.cta_placement },
      ),
      style: reason(parity.style.name, styleWhy, 'styles.csv + ui-reasoning.csv Style_Priority', {
        priority: stylePriority.join(' + '),
        best_for: parity.style.best_for,
      }),
      colors: reason(
        parity.colors.primary,
        bestColor['Product Type']
          ? `The palette is the curated set for "${bestColor['Product Type']}" (${parity.colors.notes || 'no note'}), the top match for this query. The category calls for a "${reasoning.color_mood}" mood.`
          : `No palette matched the query, so the neutral defaults were used.`,
        'colors.csv',
        { mood: reasoning.color_mood, notes: parity.colors.notes },
      ),
      typography: reason(
        `${parity.typography.heading} / ${parity.typography.body}`,
        bestTypography['Font Pairing Name']
          ? `"${bestTypography['Font Pairing Name']}" was the top-ranked pairing, built for ${parity.typography.best_for || 'this kind of product'}. The category calls for a "${reasoning.typography_mood}" tone.`
          : `No pairing matched, so Inter was used for both roles.`,
        'typography.csv',
        { mood: reasoning.typography_mood, pairing: bestTypography['Font Pairing Name'] ?? '' },
      ),
      effects: reason(
        combinedEffects,
        styleEffects
          ? `Taken from the selected style "${parity.style.name}". The style's own effects override the category's generic recommendation ("${reasoning.key_effects}").`
          : `The selected style specified no effects, so the category's recommendation was used.`,
        'styles.csv + ui-reasoning.csv Key_Effects',
      ),
      spacing: reason(
        `${tokens.spacing[0].px} to ${tokens.spacing[tokens.spacing.length - 1].px}`,
        tokens.spacingSource === 'style'
          ? `"${parity.style.name}" declares its own density (${tokens.evidence.spacing}), so the ramp is built from that base rather than the generic 8px step.`
          : `"${parity.style.name}" declares no spacing of its own, so the default 8px-based ramp is used.`,
        tokens.spacingSource === 'style'
          ? 'styles.csv Design System Variables'
          : 'default scale',
        { source: tokens.spacingSource },
      ),
      components: reason(
        `radius ${tokens.radius[0].value} / ${tokens.radius[1].value} / ${tokens.radius[2].value}, transition ${tokens.motion.duration}`,
        [
          tokens.radiusSource === 'style'
            ? `Corner radius comes from "${parity.style.name}" itself (${tokens.evidence.radius}).`
            : `"${parity.style.name}" declares no corner radius, so the default 8/12/16px is used.`,
          tokens.motion.source === 'style'
            ? `Transition duration also comes from the style (${tokens.evidence.motion}).`
            : `Transition duration falls back to the default 200ms.`,
        ].join(' '),
        tokens.radiusSource === 'style' || tokens.motion.source === 'style'
          ? 'styles.csv Design System Variables'
          : 'default component specs',
        { radius: tokens.radiusSource, motion: tokens.motion.source },
      ),
      antiPatterns: reason(
        parity.anti_patterns || 'none recorded',
        parity.anti_patterns
          ? `Recorded against "${reasoning.matched_category}" as the things that break this product category.`
          : `The reasoning row lists no anti-patterns for this category.`,
        'ui-reasoning.csv Anti_Patterns',
        reasoning.decision_rules,
      ),
    },
  };
}
