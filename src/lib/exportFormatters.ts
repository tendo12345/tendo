import type { DesignSystemOutput } from '../engine/types';

/** Turns a CSS custom-property token name into a `--kebab-case` variable name. */
function cssVarName(prefix: string, name: string): string {
  return `--${prefix}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

export function toCssVariables(output: DesignSystemOutput): string {
  const lines: string[] = [':root {', '  /* Color */'];

  const colorEntries: Array<[string, string]> = [
    ['primary', output.colors.primary],
    ['on-primary', output.colors.on_primary],
    ['secondary', output.colors.secondary],
    ['accent', output.colors.accent],
    ['background', output.colors.background],
    ['foreground', output.colors.foreground],
    ['muted', output.colors.muted],
    ['border', output.colors.border],
    ['destructive', output.colors.destructive],
    ['ring', output.colors.ring],
  ];
  for (const [name, value] of colorEntries) {
    if (!value) continue;
    lines.push(`  ${cssVarName('color', name)}: ${value};`);
  }

  lines.push('', '  /* Typography */');
  lines.push(`  --font-heading: '${output.typography.heading}', sans-serif;`);
  lines.push(`  --font-body: '${output.typography.body}', sans-serif;`);

  lines.push('', '  /* Spacing */');
  for (const s of output.spacing) {
    lines.push(`  ${s.token}: ${s.px};`);
  }

  lines.push('', '  /* Radius */');
  for (const r of output.radius) {
    lines.push(`  ${r.token}: ${r.value};`);
  }

  lines.push('', '  /* Shadow */');
  for (const s of output.shadows) {
    lines.push(`  ${s.token}: ${s.value};`);
  }

  lines.push('}');
  return lines.join('\n');
}

export function toJson(output: DesignSystemOutput): string {
  return JSON.stringify(output, null, 2);
}

export function toTailwindConfig(output: DesignSystemOutput): string {
  const spacing = output.spacing
    .map((s) => `        '${s.token.replace('--space-', '')}': '${s.rem}',`)
    .join('\n');
  const radius = output.radius
    .map((r) => `        '${r.token.replace('--radius-', '')}': '${r.value}',`)
    .join('\n');

  return `/** Generated from "${output.project_name}" — design-system-generator export */
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        primary: '${output.colors.primary}',
        secondary: '${output.colors.secondary}',
        accent: '${output.colors.accent}',
        background: '${output.colors.background}',
        foreground: '${output.colors.foreground}',
        muted: '${output.colors.muted || output.colors.background}',
        border: '${output.colors.border || output.colors.foreground}',
        destructive: '${output.colors.destructive || '#DC2626'}',
      },
      fontFamily: {
        heading: ['${output.typography.heading}', 'sans-serif'],
        body: ['${output.typography.body}', 'sans-serif'],
      },
      spacing: {
${spacing}
      },
      borderRadius: {
${radius}
      },
    },
  },
};
`;
}

export function toDesignTokensJson(output: DesignSystemOutput): string {
  const color = (value: string) => ({ value, type: 'color' });
  const dimension = (value: string) => ({ value, type: 'dimension' });

  const tokens = {
    color: {
      primary: color(output.colors.primary),
      secondary: color(output.colors.secondary),
      accent: color(output.colors.accent),
      background: color(output.colors.background),
      foreground: color(output.colors.foreground),
      muted: color(output.colors.muted || output.colors.background),
      border: color(output.colors.border || output.colors.foreground),
      destructive: color(output.colors.destructive || '#DC2626'),
    },
    typography: {
      heading: { value: output.typography.heading, type: 'fontFamily' },
      body: { value: output.typography.body, type: 'fontFamily' },
    },
    spacing: Object.fromEntries(
      output.spacing.map((s) => [s.token.replace('--space-', ''), dimension(s.px)]),
    ),
    radius: Object.fromEntries(
      output.radius.map((r) => [r.token.replace('--radius-', ''), dimension(r.value)]),
    ),
    shadow: Object.fromEntries(
      output.shadows.map((s) => [s.token.replace('--shadow-', ''), { value: s.value, type: 'shadow' }]),
    ),
  };

  return JSON.stringify(tokens, null, 2);
}

export function toMarkdown(output: DesignSystemOutput): string {
  const lines: string[] = [];
  lines.push(`# ${output.project_name || 'Design System'}`);
  lines.push('');
  lines.push(`Category: **${output.category}** · Style: **${output.style.name}**`);
  lines.push('');
  lines.push('## Colors');
  lines.push('');
  lines.push('| Token | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Primary | \`${output.colors.primary}\` |`);
  lines.push(`| Secondary | \`${output.colors.secondary}\` |`);
  lines.push(`| Accent | \`${output.colors.accent}\` |`);
  lines.push(`| Background | \`${output.colors.background}\` |`);
  lines.push(`| Foreground | \`${output.colors.foreground}\` |`);
  if (output.colors.muted) lines.push(`| Muted | \`${output.colors.muted}\` |`);
  if (output.colors.border) lines.push(`| Border | \`${output.colors.border}\` |`);
  if (output.colors.destructive) lines.push(`| Destructive | \`${output.colors.destructive}\` |`);
  lines.push('');
  lines.push('## Typography');
  lines.push('');
  lines.push(`- Heading: **${output.typography.heading}**`);
  lines.push(`- Body: **${output.typography.body}**`);
  if (output.typography.mood) lines.push(`- Mood: ${output.typography.mood}`);
  lines.push('');
  lines.push('## Spacing');
  lines.push('');
  lines.push('| Token | Value | Usage |');
  lines.push('| --- | --- | --- |');
  for (const s of output.spacing) lines.push(`| \`${s.token}\` | ${s.px} | ${s.usage} |`);
  lines.push('');
  lines.push('## Radius');
  lines.push('');
  lines.push('| Token | Value | Usage |');
  lines.push('| --- | --- | --- |');
  for (const r of output.radius) lines.push(`| \`${r.token}\` | ${r.value} | ${r.usage} |`);
  lines.push('');
  lines.push('## Reasoning');
  lines.push('');
  for (const [key, r] of Object.entries(output.reasoning)) {
    lines.push(`### ${key}`);
    lines.push('');
    lines.push(`**${r.decision}** — ${r.why}`);
    lines.push('');
    lines.push(`_Source: ${r.source}_`);
    lines.push('');
  }

  return lines.join('\n');
}
