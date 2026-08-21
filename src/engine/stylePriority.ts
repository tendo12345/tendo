/**
 * Corrections for `ui-reasoning.csv`'s `Style_Priority` column.
 *
 * 13 of the 39 distinct priority tokens name a style that does not exist in `styles.csv`.
 * The Python engine papers over this with a two-way substring match, which silently
 * resolves them to the wrong style — most damagingly `Minimalism`, which appears on 60 of
 * the 161 reasoning rows and lands on `Exaggerated Minimalism`, a loud editorial style
 * whose own "Best For" reads "Fashion, architecture, portfolios, luxury brands".
 *
 * The corrections live here rather than in `src/data/ui-reasoning.json` on purpose: the
 * ported JSON stays a faithful mirror of the upstream CSV, so it can be regenerated from a
 * newer skill revision without losing this work, and every correction stays reviewable in
 * one place.
 *
 * Only unambiguous truncations and exact-synonym cases are mapped. Priorities that name a
 * style the dataset simply does not contain are listed in UNRESOLVED and deliberately left
 * alone — inventing a target for them would be a design decision, not a data fix.
 */

/** Priority token (as written in the CSV) -> the real `Style Category` it means. */
export const STYLE_PRIORITY_ALIASES: Record<string, string> = {
  // 60 of 161 reasoning rows. "Minimalism & Swiss Style" is general-purpose minimalism;
  // "Exaggerated Minimalism" is the oversized-editorial variant and is not what a fintech,
  // government or B2B row is asking for.
  minimalism: 'Minimalism & Swiss Style',
  // Plain truncations of a longer style name.
  'data-dense': 'Data-Dense Dashboard',
  'dark mode': 'Dark Mode (OLED)',
  'vibrant & block': 'Vibrant & Block-based',
  'heat map': 'Heat Map & Heatmap Style',
  'real-time': 'Real-Time Monitoring',
  'gen z chaos': 'Gen Z Chaos / Maximalism',
};

/**
 * Priority tokens that name a style absent from `styles.csv`. No alias is guessed for
 * these; they fall through to substring matching and then keyword scoring, exactly as
 * before. Listed so the data gap stays visible instead of being silently absorbed.
 *
 * Affects 6 of the 161 reasoning rows.
 */
export const UNRESOLVED_STYLE_PRIORITIES: readonly string[] = [
  'Holographic/HUD',
  'HUD/Sci-Fi FUI',
  'Clean Science',
  'High Imagery',
  'Biomimetic/Organic 2.0',
  'E-Ink/Paper',
];

/** Map one priority token onto a real style name where a correction is known. */
export function normalizeStylePriority(priority: string): string {
  const trimmed = priority.trim();
  return STYLE_PRIORITY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** True when the token names a style the dataset does not contain. */
export function isUnresolvedPriority(priority: string): boolean {
  return UNRESOLVED_STYLE_PRIORITIES.some(
    (p) => p.toLowerCase() === priority.trim().toLowerCase(),
  );
}
