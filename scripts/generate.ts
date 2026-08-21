/**
 * Temporary CLI for the engine. No UI, no build step.
 *
 *   npm run generate -- "general purpose app clean"
 *   npm run generate -- "saas dashboard dark" --json
 *
 * The first bare argument is the product type; the rest become keywords, so the joined
 * query matches what the Python CLI would have received.
 */

import { generateDesignSystem } from '../src/engine';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const words = argv.filter((a) => !a.startsWith('--')).flatMap((a) => a.split(/\s+/)).filter(Boolean);

if (words.length === 0) {
  console.error('usage: npm run generate -- "<product type> <keywords...>" [--json]');
  process.exit(1);
}

const result = generateDesignSystem({
  productType: words[0],
  keywords: words.slice(1),
});

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const { colors, typography, style, pattern, reasoning } = result;
  console.log(`\n  ${result.project_name}`);
  console.log(`  query: "${result.query}"  ->  category: ${result.category}  [${result.severity}]\n`);

  const line = (label: string, value: string, why: string) => {
    console.log(`  ${label.padEnd(12)} ${value}`);
    console.log(`  ${''.padEnd(12)} ${why}\n`);
  };

  line('style', style.name, reasoning.style.why);
  line('palette', `${colors.primary} / ${colors.accent} on ${colors.background}`, reasoning.colors.why);
  line('type', `${typography.heading} + ${typography.body}`, reasoning.typography.why);
  line('pattern', pattern.name, reasoning.pattern.why);
  line('effects', result.key_effects || 'none', reasoning.effects.why);
  line('avoid', result.anti_patterns || 'none recorded', reasoning.antiPatterns.why);

  console.log(`  spacing      ${result.spacing.map((s) => s.px).join(' · ')}`);
  console.log(`  ${''.padEnd(12)} ${reasoning.spacing.why}\n`);
}
