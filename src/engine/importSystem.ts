/**
 * Importing and auditing an existing design system.
 *
 * Everything here is deterministic parsing and arithmetic on values the user supplies:
 * CSS custom properties, a Tailwind theme, a W3C design-token file, or plain JSON. The
 * audit reports what can be counted — duplicate values under different names, spacing that
 * breaks its own step, radii that never repeat, colour pairs that fail WCAG.
 *
 * What is NOT here, deliberately: analysing a screenshot or a rendered component. That
 * needs vision, which this tool does not have. Rather than fake it, the UI says so.
 */

import { contrastRatio, parseHex, wcagLevel } from './color';

export type ImportFormat = 'css' | 'json' | 'tailwind' | 'w3c' | 'unknown';

export interface ImportedToken {
  name: string;
  value: string;
  kind: 'color' | 'length' | 'duration' | 'other';
}

export interface ImportResult {
  format: ImportFormat;
  tokens: ImportedToken[];
  /** Lines the parser could not make sense of, so nothing is silently dropped. */
  skipped: number;
  error?: string;
}

function classify(value: string): ImportedToken['kind'] {
  const v = value.trim();
  if (parseHex(v) || /^(rgb|hsl)a?\(/i.test(v)) return 'color';
  if (/^-?\d*\.?\d+(px|rem|em)$/.test(v)) return 'length';
  if (/^-?\d*\.?\d+m?s$/.test(v)) return 'duration';
  return 'other';
}

function detectFormat(raw: string): ImportFormat {
  const text = raw.trim();
  if (!text) return 'unknown';
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      // A W3C token file marks leaves with $value.
      if (JSON.stringify(parsed).includes('"$value"')) return 'w3c';
      return 'json';
    } catch {
      // Still JSON-shaped, just broken. Reporting the parse error is more useful than
      // claiming the format is unrecognisable.
      return 'json';
    }
  }
  if (/--[a-z0-9-]+\s*:/i.test(text)) return 'css';
  if (/module\.exports|export default|theme\s*:/.test(text)) return 'tailwind';
  return 'unknown';
}

function parseCss(raw: string): { tokens: ImportedToken[]; skipped: number } {
  const tokens: ImportedToken[] = [];

  // Scanned over the whole input rather than line by line: CSS is frequently written or
  // minified onto a single line, and a per-line parser silently keeps only the first
  // declaration of each.
  for (const m of raw.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    const value = m[2].trim();
    if (value) tokens.push({ name: m[1], value, kind: classify(value) });
  }

  // Anything that looks like a declaration but is not a custom property.
  const allDeclarations = [...raw.matchAll(/([a-z-]+)\s*:\s*([^;}]+)/gi)].filter(
    (m) => !m[1].startsWith('--'),
  );

  return { tokens, skipped: allDeclarations.length };
}

/** Walk a nested object into dotted token names. Handles W3C `$value` leaves. */
function flatten(obj: unknown, prefix: string, out: ImportedToken[]): void {
  if (obj === null || typeof obj !== 'object') return;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key.startsWith('$') && key !== '$value') continue;
    const name = key === '$value' ? prefix : prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || typeof value === 'number') {
      const str = String(value);
      out.push({ name, value: str, kind: classify(str) });
    } else if (value && typeof value === 'object') {
      flatten(value, name, out);
    }
  }
}

export function importTokens(raw: string): ImportResult {
  const format = detectFormat(raw);

  if (format === 'unknown') {
    return {
      format,
      tokens: [],
      skipped: 0,
      error:
        'Could not tell what this is. Basis reads CSS custom properties, a JSON object, a W3C design-token file, or a Tailwind theme block.',
    };
  }

  if (format === 'css' || format === 'tailwind') {
    const { tokens, skipped } = parseCss(raw);
    if (tokens.length === 0 && format === 'tailwind') {
      // A Tailwind config is JS, not CSS. Pull quoted key/value pairs instead.
      const out: ImportedToken[] = [];
      for (const m of raw.matchAll(/['"]?([a-z0-9-]+)['"]?\s*:\s*['"]([^'"]+)['"]/gi)) {
        out.push({ name: m[1], value: m[2], kind: classify(m[2]) });
      }
      return { format, tokens: out, skipped: 0 };
    }
    return { format, tokens, skipped };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const out: ImportedToken[] = [];
    flatten(parsed, '', out);
    return { format, tokens: out, skipped: 0 };
  } catch (e) {
    return { format, tokens: [], skipped: 0, error: `That is not valid JSON: ${(e as Error).message}` };
  }
}

export type AuditSeverity = 'info' | 'warning' | 'attention';

export interface ImportFinding {
  id: string;
  title: string;
  severity: AuditSeverity;
  detail: string;
  /** The token names involved, so the user can go and look. */
  tokens: string[];
}

/**
 * Audit an imported token set.
 *
 * Only checks that are computable and unambiguous. No opinion is offered on naming style
 * or palette taste — those are judgement calls the tool has no standing to make.
 */
export function auditImportedTokens(tokens: ImportedToken[]): ImportFinding[] {
  const findings: ImportFinding[] = [];

  /* ---- duplicate values under different names ---- */
  const byValue = new Map<string, string[]>();
  for (const t of tokens) {
    const key = t.value.trim().toLowerCase();
    byValue.set(key, [...(byValue.get(key) ?? []), t.name]);
  }
  const dupes = [...byValue.entries()].filter(([, names]) => names.length > 1);
  if (dupes.length > 0) {
    findings.push({
      id: 'duplicates',
      title: 'Duplicate values under different names',
      severity: 'warning',
      detail: `${dupes.length} ${dupes.length === 1 ? 'value appears' : 'values appear'} under more than one token name. Either they mean the same thing and should be one token with aliases, or they will drift apart the first time someone changes one.`,
      tokens: dupes.flatMap(([value, names]) => `${value}: ${names.join(', ')}`),
    });
  }

  /* ---- spacing consistency ---- */
  const lengths = tokens
    .filter((t) => t.kind === 'length' && /space|spacing|gap|size/i.test(t.name))
    .map((t) => ({ name: t.name, px: toPx(t.value) }))
    .filter((t): t is { name: string; px: number } => t.px !== null && t.px > 0)
    .sort((a, b) => a.px - b.px);

  if (lengths.length >= 3) {
    const base = lengths[0].px;
    const offGrid = lengths.filter((l) => l.px % base !== 0);
    findings.push({
      id: 'spacing-grid',
      title: 'Spacing scale consistency',
      severity: offGrid.length === 0 ? 'info' : 'warning',
      detail:
        offGrid.length === 0
          ? `All ${lengths.length} spacing tokens are multiples of the smallest (${base}px), so the scale holds together.`
          : `${offGrid.length} of ${lengths.length} spacing tokens are not multiples of the smallest value (${base}px). A scale with arbitrary steps stops being a scale.`,
      tokens: offGrid.map((l) => `${l.name}: ${l.px}px`),
    });
  }

  /* ---- radius consistency ---- */
  const radii = tokens
    .filter((t) => t.kind === 'length' && /radius|rounded|corner/i.test(t.name))
    .map((t) => ({ name: t.name, px: toPx(t.value) }))
    .filter((t): t is { name: string; px: number } => t.px !== null);

  if (radii.length >= 4) {
    const distinct = new Set(radii.map((r) => r.px));
    if (distinct.size === radii.length && radii.length > 4) {
      findings.push({
        id: 'radius-spread',
        title: 'Every radius is different',
        severity: 'warning',
        detail: `${radii.length} radius tokens with ${distinct.size} distinct values and no repetition. A radius scale usually has a few values reused deliberately, not one per component.`,
        tokens: radii.map((r) => `${r.name}: ${r.px}px`),
      });
    }
  }

  /* ---- contrast between plausible text and background pairs ---- */
  const colors = tokens.filter((t) => t.kind === 'color' && parseHex(t.value));
  const backgrounds = colors.filter((t) => /bg|background|surface|canvas|paper/i.test(t.name));
  const foregrounds = colors.filter((t) => /text|fg|foreground|ink|content/i.test(t.name));

  if (backgrounds.length > 0 && foregrounds.length > 0) {
    const failures: string[] = [];
    let checked = 0;
    for (const bg of backgrounds) {
      for (const fg of foregrounds) {
        const ratio = contrastRatio(fg.value, bg.value);
        if (ratio === null) continue;
        checked++;
        if (ratio < 4.5) {
          failures.push(`${fg.name} on ${bg.name}: ${ratio.toFixed(2)}:1 (${wcagLevel(ratio)})`);
        }
      }
    }
    findings.push({
      id: 'contrast',
      title: 'Text and background contrast',
      severity: failures.length === 0 ? 'info' : failures.length > checked / 2 ? 'attention' : 'warning',
      detail:
        failures.length === 0
          ? `All ${checked} text-on-background combinations clear 4.5:1.`
          : `${failures.length} of ${checked} text-on-background combinations fall below 4.5:1. Not every pair is necessarily used together — check the ones that are.`,
      tokens: failures,
    });
  }

  /* ---- missing semantic roles ---- */
  const named = tokens.map((t) => t.name.toLowerCase()).join(' ');
  const missing = [
    ['focus', /focus|ring/],
    ['error', /error|danger|destructive/],
    ['success', /success|positive/],
    ['warning', /warning|caution/],
    ['disabled', /disabled|muted/],
  ]
    .filter(([, re]) => !(re as RegExp).test(named))
    .map(([role]) => role as string);

  if (missing.length > 0) {
    findings.push({
      id: 'missing-roles',
      title: 'Semantic roles with no token',
      severity: 'warning',
      detail: `No token found for: ${missing.join(', ')}. These states will get hardcoded at the call site, which is where systems start to leak.`,
      tokens: missing,
    });
  }

  return findings;
}

function toPx(value: string): number | null {
  const m = value.trim().match(/^(-?\d*\.?\d+)(px|rem|em)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === 'rem' || m[2] === 'em' ? n * 16 : n;
}
