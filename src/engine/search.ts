/**
 * Domain search, ported from `scripts/core.py` (commit 7538cfb).
 *
 * Only the five domains the design-system path touches are ported; the CLI's other
 * domains (ux, icons, charts, stacks, google-fonts) are not part of Phase 1.
 */

import { BM25 } from './bm25';
import { SCRIPT_PAIRING } from './region';
import type { Domain, Row, SearchResult } from './types';

import colors from '../data/colors.json';
import landing from '../data/landing.json';
import products from '../data/products.json';
import styles from '../data/styles.json';
import typography from '../data/typography.json';

export const MAX_RESULTS = 3;

interface DomainConfig {
  file: string;
  data: Row[];
  search_cols: string[];
  /**
   * The subset of `search_cols` that NAMES the row, as opposed to prose about it.
   *
   * Both are searched and both rank rows, but only these may decide which row a query is
   * *about* — see the corroboration rule in `searchCsv`. Not present in the Python, which has
   * no such distinction.
   *
   * ONLY THE PRODUCT DOMAIN SETS THIS, and that is a measured decision rather than caution.
   * Applied to all five domains it changed 18 picks across the 65 pinned queries, and the
   * changes went both ways: the `banking mobile secure nigeria` palette improved from
   * Password Manager to Banking/Traditional Finance, but `fin-tech` degraded from
   * Fintech/Crypto to Pet Tech App — "fin-tech" tokenises to `fin` + `tech`, and `tech` names
   * Pet Tech App while nothing in Fintech/Crypto's name matches `fin`. Style was worse still:
   * `crypto` fell from Cyberpunk UI to Terminal CLI (Mobile), reintroducing the mobile-variant
   * crowding that judgment call 2 exists to fix. Prose earns its place in those domains; in
   * products it was naming categories on its own.
   */
  identity_cols?: string[];
  output_cols: string[];
}

/** Mirrors CSV_CONFIG in core.py. Column names are the CSV headers verbatim. */
export const CSV_CONFIG: Record<Domain, DomainConfig> = {
  style: {
    file: 'styles.csv',
    data: styles as Row[],
    search_cols: ['Style Category', 'Keywords', 'Best For', 'Type', 'AI Prompt Keywords'],
    output_cols: [
      'Style Category', 'Type', 'Keywords', 'Primary Colors', 'Effects & Animation',
      'Best For', 'Light Mode ✓', 'Dark Mode ✓', 'Performance', 'Accessibility',
      'Framework Compatibility', 'Complexity', 'AI Prompt Keywords',
      'CSS/Technical Keywords', 'Implementation Checklist', 'Design System Variables',
    ],
  },
  color: {
    file: 'colors.csv',
    data: colors as Row[],
    search_cols: ['Product Type', 'Notes'],
    output_cols: [
      'Product Type', 'Primary', 'On Primary', 'Secondary', 'On Secondary', 'Accent',
      'On Accent', 'Background', 'Foreground', 'Card', 'Card Foreground', 'Muted',
      'Muted Foreground', 'Border', 'Destructive', 'On Destructive', 'Ring', 'Notes',
    ],
  },
  landing: {
    file: 'landing.csv',
    data: landing as Row[],
    search_cols: ['Pattern Name', 'Keywords', 'Conversion Optimization', 'Section Order'],
    output_cols: [
      'Pattern Name', 'Keywords', 'Section Order', 'Primary CTA Placement',
      'Color Strategy', 'Conversion Optimization',
    ],
  },
  product: {
    file: 'products.csv',
    data: products as Row[],
    search_cols: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
    // 'Key Considerations' is implementation prose — "market prices", "emoji picker",
    // "receipt camera". A word appearing only there cannot name the category.
    identity_cols: ['Product Type', 'Keywords'],
    output_cols: [
      'Product Type', 'Keywords', 'Primary Style Recommendation', 'Secondary Styles',
      'Landing Page Pattern', 'Dashboard Style (if applicable)', 'Color Palette Focus',
    ],
  },
  typography: {
    file: 'typography.csv',
    data: typography as Row[],
    search_cols: ['Font Pairing Name', 'Category', 'Mood/Style Keywords', 'Best For', 'Heading Font', 'Body Font'],
    output_cols: [
      'Font Pairing Name', 'Category', 'Heading Font', 'Body Font', 'Mood/Style Keywords',
      'Best For', 'Google Fonts URL', 'CSS Import', 'Tailwind Config', 'Notes',
    ],
  },
};

/**
 * English function words, removed from a query before it picks a FONT.
 *
 * The dataset is mostly keyword lists, so a preposition that appears in two rows of prose
 * scores as if it were a rare, meaningful term: "a recipe app for home cooks" selected
 * `Neo Brutalism Mobile` on the word "for", and "the and but" selected a Web3 crypto pairing.
 * A word from this list may still rank a row it genuinely belongs to; it may no longer be the
 * reason a pairing is chosen.
 */
const FUNCTION_WORDS = new Set([
  'the', 'and', 'but', 'for', 'with', 'from', 'that', 'this', 'into', 'our', 'your', 'their',
  'its', 'are', 'was', 'were', 'been', 'has', 'have', 'had', 'will', 'would', 'can', 'could',
  'should', 'about', 'over', 'under', 'than', 'then', 'there', 'here', 'when', 'where', 'how',
  'why', 'all', 'any', 'some', 'each', 'both', 'not', 'own', 'same', 'very', 'just', 'also',
  'only',
]);

const SCRIPT_PAIRINGS = new Set(Object.values(SCRIPT_PAIRING));

/**
 * Rules that apply to typography and nothing else, because the harm is specific to fonts.
 *
 * A palette matched on an incidental word is merely a poor palette. A FONT matched on an
 * incidental word can be unreadable: "A savings app for market traders in Lagos." resolved to
 * Noto Sans SC, because "market" appears in Chinese Simplified's Best For — "mainland China
 * market". Three of the four rows that scored at all were script-specific pairings, each on
 * that one word, and none of them can render the product's own language.
 *
 * So a script-specific pairing is eligible only when the query names its script — which its
 * own name, category and mood keywords carry, so "chinese simplified site" and "japanese app"
 * still reach them. The region does NOT open this gate: region never changes selection (see
 * region.ts), it reports afterwards whether the chosen pairing can render the script.
 *
 * Everything else is untouched. "insurance claims clarity" still resolves to Financial Trust
 * on the word "insurance" in its Best For, which is that pairing's actual audience.
 */
const TYPOGRAPHY_RULES: SearchRules = {
  dropFunctionWords: true,
  eligible: (row, queryTokens, tokenize) => {
    const name = String(row['Font Pairing Name'] ?? '');
    if (!SCRIPT_PAIRINGS.has(name)) return true;
    const names = tokenize([name, row['Category'], row['Mood/Style Keywords']].map((v) => String(v ?? '')).join(' '));
    return names.some((token) => queryTokens.has(token));
  },
};

export interface SearchRules {
  /** Columns that name the row, for the corroboration rule. */
  identityCols?: string[];
  /** Drop English function words from the query before ranking. */
  dropFunctionWords?: boolean;
  /** A row may be returned only if this says so. Ranking is unchanged; eligibility is not. */
  eligible?: (row: Row, queryTokens: Set<string>, tokenize: (text: string) => string[]) => boolean;
  /**
   * Optional sink for the BM25 scores behind the returned rows, the best score that did NOT
   * make the cut, and any row a rule refused. Purely observational — it never affects ranking
   * or selection, and exists so the UI can describe how a choice was made without guessing.
   */
  scoreSink?: { scores: number[]; runnerUp: number; excluded?: string[] };
}

/**
 * Rank rows of one domain against a query.
 *
 * Matches `_search_csv`: build one document per row by joining its search columns,
 * rank with BM25, keep the top N with score > 0, project down to the output columns.
 *
 * WITH ONE DELIBERATE DIFFERENCE: a row may only be returned on the strength of a term that
 * appears in the columns that NAME it. Prose columns still rank rows; they cannot, alone,
 * decide what a query is about. See PORTING-NOTES judgment call 7 for the measurement.
 *
 * Why: every row's document is one bag of words, so an incidental word in a notes column
 * counts exactly as much as the row's own keywords — and counts for MORE when the row is
 * short, because BM25 rewards brevity. "A savings app for market traders in Lagos" resolved
 * to Agriculture/Farm Tech: "market" appears in exactly one row of 161, inside Agriculture's
 * implementation notes ("market prices"), and that row is short, so it scored 5.03 against
 * Personal Finance Tracker's 3.93 for the actual keyword "savings".
 *
 * Rows with no identity match are not discarded — if NOTHING is corroborated, the original
 * ranking stands, so no query loses a result it used to have.
 */
export function searchCsv(
  data: Row[],
  searchCols: string[],
  outputCols: string[],
  query: string,
  maxResults: number,
  rules: SearchRules = {},
): Row[] {
  const { identityCols, dropFunctionWords, eligible, scoreSink } = rules;
  const documents = data.map((row) => searchCols.map((col) => String(row[col] ?? '')).join(' '));

  const bm25 = new BM25();
  bm25.fit(documents);

  const tokenize = (text: string) => bm25.tokenize(text);
  const base = dropFunctionWords
    ? bm25.tokenize(query).filter((token) => !FUNCTION_WORDS.has(token))
    : bm25.tokenize(query);
  /*
    A hyphenated word also asks for its joined form.

    The tokenizer splits on punctuation, so "fin-tech" arrives as `fin` + `tech` — and the
    dataset spells it `fintech`, as one word, in Fintech/Crypto's keywords. The query matched
    `tech` against Space Tech / Aerospace instead, which is how a fintech query came back as
    aerospace. Same for "e-commerce" against `ecommerce` and "non-profit" against `nonprofit`.

    Added, never substituted: the split tokens still count, so nothing that matched before
    stops matching. Only forms already absent are appended, because a repeated query token
    would be scored twice — the Python counts query tokens with their multiplicity and so
    does this.
  */
  const joined = [...query.matchAll(/[\p{L}\p{N}]+(?:[-./][\p{L}\p{N}]+)+/gu)]
    .map((match) => match[0].replace(/[-./]/g, '').toLowerCase())
    .filter((word) => word.length > 2 && !base.includes(word));
  const asked = [...base, ...new Set(joined)];
  const scored = asked.length > 0 ? bm25.score(asked.join(' ')) : [];

  const identity = identityCols ?? searchCols;
  const queryTokens = new Set(asked);
  const namesIt = (idx: number) => {
    const tokens = bm25.tokenize(identity.map((col) => String(data[idx][col] ?? '')).join(' '));
    return tokens.some((token) => queryTokens.has(token));
  };

  const scoring = scored.filter(([, score]) => score > 0);
  const allowed = eligible ? scoring.filter(([idx]) => eligible(data[idx], queryTokens, tokenize)) : scoring;
  if (scoreSink && eligible) {
    // Every refusal, not the first `maxResults` of them: this list is reported to the reader
    // as a count ("2 pairings scored…"), so a truncated one states a wrong number. There are
    // at most eight script pairings in the dataset, so the list stays short on its own.
    scoreSink.excluded = scoring
      .filter(([idx]) => !allowed.some(([kept]) => kept === idx))
      .map(([idx]) => String(data[idx][searchCols[0]] ?? ''));
  }
  const corroborated = allowed.filter(([idx]) => namesIt(idx));
  const ranked = corroborated.length > 0 ? corroborated : allowed;

  const results: Row[] = [];
  for (const [idx, score] of ranked.slice(0, maxResults)) {
    if (score > 0) {
      const row = data[idx];
      const projected: Row = {};
      for (const col of outputCols) {
        // Python: `if col in row` — absent columns are dropped, empty ones are kept.
        if (col in row) projected[col] = row[col] ?? '';
      }
      results.push(projected);
      scoreSink?.scores.push(score);
    }
  }

  if (scoreSink) {
    const next = ranked[results.length];
    scoreSink.runnerUp = next && next[1] > 0 ? next[1] : 0;
  }

  return results;
}

export function search(query: string, domain: Domain, maxResults: number = MAX_RESULTS): SearchResult {
  const config = CSV_CONFIG[domain] ?? CSV_CONFIG.style;
  const sink: NonNullable<SearchRules['scoreSink']> = { scores: [], runnerUp: 0 };
  const results = searchCsv(config.data, config.search_cols, config.output_cols, query, maxResults, {
    identityCols: config.identity_cols,
    ...(domain === 'typography' ? TYPOGRAPHY_RULES : {}),
    scoreSink: sink,
  });

  return {
    domain,
    query,
    file: config.file,
    count: results.length,
    results,
    scores: sink.scores,
    runnerUpScore: sink.runnerUp,
    ...(sink.excluded && sink.excluded.length > 0 ? { excluded: sink.excluded } : {}),
  };
}

/**
 * The row of a domain named exactly `value` in its first search column, projected like a
 * search result. Used where two files share a key — see the palette in designSystem.ts.
 */
export function rowNamed(domain: Domain, value: string): Row | undefined {
  const config = CSV_CONFIG[domain];
  const row = config.data.find((candidate) => String(candidate[config.search_cols[0]] ?? '') === value);
  if (!row) return undefined;
  const projected: Row = {};
  for (const col of config.output_cols) if (col in row) projected[col] = row[col] ?? '';
  return projected;
}
