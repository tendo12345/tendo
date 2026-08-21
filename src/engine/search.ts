/**
 * Domain search, ported from `scripts/core.py` (commit 7538cfb).
 *
 * Only the five domains the design-system path touches are ported; the CLI's other
 * domains (ux, icons, charts, stacks, google-fonts) are not part of Phase 1.
 */

import { BM25 } from './bm25';
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
 * Rank rows of one domain against a query.
 *
 * Matches `_search_csv`: build one document per row by joining its search columns,
 * rank with BM25, keep the top N with score > 0, project down to the output columns.
 */
export function searchCsv(
  data: Row[],
  searchCols: string[],
  outputCols: string[],
  query: string,
  maxResults: number,
  /**
   * Optional sink for the BM25 scores behind the returned rows, plus the best score that
   * did NOT make the cut. Purely observational — it never affects ranking or selection,
   * and exists so the UI can describe how decisive a match was without guessing.
   */
  scoreSink?: { scores: number[]; runnerUp: number },
): Row[] {
  const documents = data.map((row) => searchCols.map((col) => String(row[col] ?? '')).join(' '));

  const bm25 = new BM25();
  bm25.fit(documents);
  const ranked = bm25.score(query);

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
  const sink = { scores: [] as number[], runnerUp: 0 };
  const results = searchCsv(
    config.data,
    config.search_cols,
    config.output_cols,
    query,
    maxResults,
    sink,
  );

  return {
    domain,
    query,
    file: config.file,
    count: results.length,
    results,
    scores: sink.scores,
    runnerUpScore: sink.runnerUp,
  };
}
