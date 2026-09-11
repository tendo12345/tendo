import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
  The dataset must not ship on first load.

  CLAUDE.md claimed it did not, from the initial commit onward, and the claim was false the
  whole time: GeneratedSystemContext — mounted at the root in main.tsx — imported the engine,
  so the entry chunk pulled in all of src/data (~100 kB gzipped) and index.html preloaded it
  for every visitor. Nothing checked the claim, so nothing noticed.

  This walks the STATIC import graph from main.tsx the way the bundler does — value imports,
  side-effect imports and re-exports; not `import type`, not `import()` — and fails if any
  path reaches the dataset. When it fails, the chain it prints is the fix: the first file in
  it that the landing page does not need is the one that should stop importing.
*/

const ROOT = join(process.cwd(), 'src');
const ENTRY = join(ROOT, 'main.tsx');

/** Precomputed files that live in src/data on purpose, and are meant for first load. */
const ALLOWED_DATA = ['sample-system.json', 'coverage.json'];

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx'];

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // a package — not our graph
  const base = resolve(dirname(from), spec.replace(/\?.*$/, ''));
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && !candidate.endsWith('/') && /\.(tsx?|jsx?|json|css)$/.test(candidate)) return candidate;
  }
  return null;
}

/** Specifiers this file imports for their VALUES, at load time. */
function staticImports(file: string): string[] {
  if (!/\.(tsx?|jsx?)$/.test(file)) return [];
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const specs: string[] = [];
  // import x from '…' / import { a } from '…' / export { a } from '…' / export * from '…'
  for (const m of source.matchAll(/^\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    if (m[2]) continue; // `import type` / `export type` — erased at build time
    const clause = m[3].trim();
    // `import { type A, type B } from` is erased too; one value binding keeps it.
    const braces = clause.match(/^\{([\s\S]*)\}$/);
    if (braces && braces[1].split(',').every((b) => !b.trim() || /^type\s/.test(b.trim()))) continue;
    specs.push(m[4]);
  }
  // import './side-effect'
  for (const m of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specs.push(m[1]);
  return specs;
}

/** Breadth-first, so the chain reported for a violation is the shortest one. */
function reachable(entry: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    for (const spec of staticImports(file)) {
      const target = resolveImport(file, spec);
      if (target && !parent.has(target)) {
        parent.set(target, file);
        queue.push(target);
      }
    }
  }
  return parent;
}

function chain(parent: Map<string, string | null>, file: string): string {
  const path: string[] = [];
  for (let f: string | null = file; f; f = parent.get(f) ?? null) path.unshift(relative(ROOT, f).replace(/\\/g, '/'));
  return path.join(' -> ');
}

describe('first load', () => {
  const graph = reachable(ENTRY);
  const files = [...graph.keys()];

  it('actually walks the app — a broken resolver would pass by reaching nothing', () => {
    const rel = files.map((f) => relative(ROOT, f).replace(/\\/g, '/'));
    expect(rel).toContain('App.tsx');
    expect(rel).toContain('components/home/Hero.tsx');
    expect(rel).toContain('context/GeneratedSystemContext.tsx');
    expect(files.length).toBeGreaterThan(40);
  });

  it('does not reach the dataset', () => {
    const leaks = files
      .filter((f) => relative(ROOT, f).replace(/\\/g, '/').startsWith('data/'))
      .filter((f) => !ALLOWED_DATA.some((name) => f.endsWith(name)))
      .map((f) => chain(graph, f));
    expect(leaks).toEqual([]);
  });

  it('does not reach the generator, which is the dataset one import away', () => {
    const generator = files.find((f) => relative(ROOT, f).replace(/\\/g, '/') === 'engine/designSystem.ts');
    expect(generator ? chain(graph, generator) : null).toBeNull();
  });
});
