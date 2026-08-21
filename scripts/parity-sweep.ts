/**
 * Holdout parity sweep. Compares the TS engine against a JSON dump of the Python engine
 * over queries the port was never tuned against.
 *
 *   npx tsx scripts/parity-sweep.ts <python-dump.json>
 *
 * The dump maps query string -> the dict returned by DesignSystemGenerator.generate().
 */

import { readFileSync } from 'node:fs';
import { generateDesignSystem } from '../src/engine';
import type { PythonParityOutput } from '../src/engine';

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('usage: npx tsx scripts/parity-sweep.ts <python-dump.json>');
  process.exit(1);
}

const dump = JSON.parse(readFileSync(dumpPath, 'utf-8')) as Record<string, PythonParityOutput>;

let pass = 0;
const failures: string[] = [];

for (const [query, expected] of Object.entries(dump)) {
  const words = query.split(/\s+/);
  const actual = generateDesignSystem({ productType: words[0], keywords: words.slice(1) });

  const parity: PythonParityOutput = {
    project_name: actual.project_name,
    category: actual.category,
    pattern: actual.pattern,
    style: actual.style,
    colors: actual.colors,
    typography: actual.typography,
    key_effects: actual.key_effects,
    anti_patterns: actual.anti_patterns,
    decision_rules: actual.decision_rules,
    severity: actual.severity,
  };

  const a = JSON.stringify(parity, Object.keys(parity).sort());
  const b = JSON.stringify(expected, Object.keys(parity).sort());

  if (a === b) {
    pass++;
  } else {
    const diffs: string[] = [];
    for (const key of Object.keys(parity) as Array<keyof PythonParityOutput>) {
      const av = JSON.stringify(parity[key]);
      const bv = JSON.stringify(expected[key]);
      if (av !== bv) diffs.push(`      ${key}\n        ts: ${av}\n        py: ${bv}`);
    }
    failures.push(`  ${query}\n${diffs.join('\n')}`);
  }
}

const total = Object.keys(dump).length;
console.log(`\n  parity: ${pass}/${total} queries identical\n`);
if (failures.length > 0) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
