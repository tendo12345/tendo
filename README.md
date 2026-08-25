# design-system-generator

Generates a design system — palette, type pairing, style, layout pattern, tokens — from a
short description of a product, and explains why it chose each one.

The reasoning engine (`src/engine`) is a port of the Python `ui-ux-pro-max` CLI, validated
against it query by query. The app around it lives in `src/components`, `src/pages` and
`src/lib`.

Radius, spacing and motion are derived from the matched style rather than fixed, so a
brutalist system previews at 0px corners and a flat one at 2px. See
[PORTING-NOTES.md](PORTING-NOTES.md) item 1.

## Use it

```bash
npm install
npm run dev                                 # the app, on :5173
```

```bash
npm test                                    # 153 tests, incl. parity vs the Python engine
npm run generate -- "general purpose app clean"
npm run generate -- "saas dashboard dark" --json
```

In code:

```ts
import { generateDesignSystem } from './src/engine';

const system = generateDesignSystem({
  productType: 'general',
  keywords: ['purpose', 'app', 'clean'],
  industry: undefined,      // optional
  region: undefined,        // accepted, not yet used — see PORTING-NOTES.md
});

system.category;                    // 'SaaS (General)'
system.colors.primary;              // '#2563EB'
system.typography.heading;          // 'Outfit'
system.reasoning.colors.why;        // why that palette, citing the source row
```

`generateDesignSystem()` is pure — no I/O, no React, no globals. Same input, same output.

An MCP server (`mcp-server/`) exposes the current generated system to AI coding agents
(Claude Code, Cursor) — tokens, palette, typography and component rules as structured JSON or
as CSS variables / Tailwind config / Style Dictionary. See
[mcp-server/README.md](mcp-server/README.md).

## Layout

```
src/
  data/       six JSON files ported from the skill's CSVs, schema unchanged
  engine/     bm25 · search · designSystem · styleTokens · stylePriority · constants · types
    __tests__/
      fixtures/   captured Python output + the reviewed divergence list
scripts/
  generate.ts             CLI for the engine, no UI needed
  divergence.ts           full report of how the engine differs from the Python
  capture-divergence.ts   regenerate the reviewed divergence list
  parity-sweep.ts         diff the TS engine against a Python dump
  capture-ground-truth.py regenerate fixtures from the Python skill
mcp-server/
  src/          MCP server (get_design_system, export_tokens, list_components)
```

Nothing in `src/data` or `src/engine` imports React or touches the DOM.

## Read next

**[PORTING-NOTES.md](PORTING-NOTES.md)** — which upstream commit the engine is faithful to,
where it now deliberately diverges, and the six judgment calls found baked into the Python
source. Items 1 and 2 are fixed (style-derived tokens; exact-match-first style selection,
which lifted exact resolution from 102 to 140 of 161 product types). Items 3 to 6 are still
open, `region` being the one most likely to matter next.
