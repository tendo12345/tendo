# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Basis** â€” a client-side tool that generates a design system from a one-sentence product
description, and shows the reasoning behind every choice. Vite + React + TypeScript, no
backend, no accounts. See `ABOUT.md` for the product framing and `PORTING-NOTES.md` for the
engine's history and open decisions.

The reasoning engine is a TypeScript port of the Python `ui-ux-pro-max` skill, pinned to
upstream commit `7538cfb` (MIT, `licenses/`). **`PORTING-NOTES.md` is required reading before
touching `src/engine` or `src/data`** â€” it records what the port is faithful to, where it
deliberately diverges, and which judgment calls are still open.

## Commands

```bash
npm run dev              # vite dev server on :5173
npm run build            # tsc -b && vite build â€” run before finishing
npm test                 # vitest run (single pass)
npm run test:watch
npm run lint             # oxlint
npm run generate -- "general purpose app clean"   # headless CLI, add --json for full output
npm run sweep -- src/engine/__tests__/fixtures/python-holdout.json   # parity diff vs a Python dump
```

Single test file or single case:

```bash
npx vitest run src/engine/__tests__/ground.test.ts
npx vitest run -t "never degrades a text role"
```

The global vitest environment is `node`, so the engine suite runs without a DOM. A test that
needs one opts in per file with a `// @vitest-environment jsdom` docblock â€” see
`src/hooks/useThemePreference.test.ts`. Keep it per-file: jsdom costs several seconds of
startup, and almost nothing here needs it.

Two diagnostics that are not tests but answer "did I break the port?":

```bash
npx tsx scripts/divergence.ts          # every deliberate difference vs the Python, classified
npx tsx scripts/capture-divergence.ts  # REGENERATES the pinned divergence list â€” see below
```

Re-capturing Python ground truth needs the upstream skill checked out and Python installed:

```bash
python scripts/capture-ground-truth.py --skill-scripts <path>/ui-ux-pro-max/scripts \
  --set holdout --out src/engine/__tests__/fixtures/python-holdout.json
```

## Architecture

### The engine / UI split is load-bearing

```
src/data/      six JSON files ported verbatim from the skill's CSVs (~540 kB)
src/engine/    pure TypeScript. No React, no DOM, no imports from src/lib
src/lib/       UI-layer helpers (clipboard, exports, theme, localStorage)
src/components/workspace/   the post-generation workspace panes
src/pages/Workspace.tsx     one section at a time, addressed by URL (/system/:section)
```

`src/engine` must stay importable without a browser â€” the whole test suite depends on it.
Matching logic never goes in a component; components read `DesignSystemOutput` and render.

### How generation flows

`generateDesignSystem(input)` (`engine/designSystem.ts`) is pure and deterministic â€” same
input, same output, no randomness. It:

1. BM25-searches `products.json` for the product category
2. looks up that category's row in `ui-reasoning.json`
3. searches style / color / landing / typography, biasing the style query with `Style_Priority`
4. picks one row per domain
5. derives radius, spacing and motion from the matched style's `Design System Variables`

Everything else is a **derived view over that output**, not part of selection:
`semanticTokens`, `matchQuality`, `systemDna`, `accessibility`, `systemHealth`, `darkMode`,
`componentStates`, `productPatterns`, `variations`, `aiContext`, `ground`, `importSystem`.
Adding a feature almost always means adding another derived view, not editing the generator.

### Parity is a contract, not a vibe

The engine is validated field-by-field against captured output from the Python original
(`src/engine/__tests__/fixtures/python-*.json`). Palettes, fonts, categories and patterns
must match exactly. Style selection deliberately differs on 16 queries, and each one is
pinned with both values in `fixtures/intended-divergence.json`.

**Never run `capture-divergence.ts` to make a failing test pass.** A new entry there means
the matcher changed behaviour on a query that used to agree with the Python. Review the diff,
understand why, then re-pin.

### Saved systems store the input, not the output

A saved system persists its `GenerateInput` (~61 bytes), never the generated output (~8.4 kB
â€” measured, 138Ã— larger). The engine is deterministic, so the system is rebuilt on open.
That is why saved rows cannot go stale the way stored output did: shape drift crashed the app
twice (`provenance`, then `ground`).

The cost runs the other way â€” change selection logic and an old input regenerates into a
different system. `engine/version.ts` makes that visible rather than silent. Bump
`ENGINE_VERSION` when a change alters output for an unchanged input (not for additive
fields), and `detectDrift` separates "the engine moved but this system did not" from "this
actually changed", so a release that touched one category does not warn every user.

All saving goes through the `SystemStore` port (`lib/systemStore.ts`), implemented today by
`localSystemStore` and later by an account-backed store. **Every method is async even though
localStorage is not** â€” that is deliberate, so swapping in a network-backed store needs no
call-site changes.

`sessionStorage` still caches the *current* system in `GeneratedSystemContext`, and that one
does hold full output â€” bump its `SCHEMA_VERSION` when the output shape changes.

### Changing what the engine outputs

`src/engine/__tests__/engineVersion.test.ts` pins the fingerprint of five known queries. When
one fails, decide which happened:

- **intended** â†’ update the hash *and* bump `ENGINE_VERSION` in `engine/version.ts`
- **accidental** â†’ fix the code

Never update a pinned hash without bumping the version. Saved systems rebuild from their
input, so an unbumped change silently regenerates everyone's saved work with no drift
warning â€” that is precisely what this guards.

Derived text colours are **contrast-solved, not fixed mixes**. `fadeToward` in
`semanticTokens.ts` backs the fade off until the result clears AA plus a margin. The old flat
50% mix parked `color.text.muted` on the 4.5 line by construction, which failed outright on
some palettes and left no headroom for the generated ground (8 of 120 systems could carry a
wash; now 101 do).

### The dataset is stripped, and that is verified

`npm run data:check` reports which columns the engine never reads; `data:strip` removes them
and `data:verify` regenerates all 161 product types to prove nothing moved. The keep-list is
derived from `CSV_CONFIG`, with columns read by direct property access listed in `EXTRA` â€”
that list is the fragile part, which is why the verify step exists. Always run it after a
strip.

Column stripping is worth ~9 kB gzipped, not more: gzip already collapses the redundancy.
The dataset lives in its own `design-data` chunk (see `vite.config.ts`) so app deploys do
not invalidate it, and it is no longer part of first load: every route that reaches the
engine is lazily imported in `App.tsx`, and the landing page renders from a build-time
precomputed sample instead of importing the engine to generate one. First load is ~98 kB
gzipped, down from ~224 kB.

Two things keep that saving from silently unwinding: `sampleSystem.ts` must import the
engine **type-only** (a value import drags the dataset back into the landing chunk), and
`sample-system.json` is excluded from the `design-data` chunk on purpose. Regenerate it
with `npm run build:sample`; a test fails if it drifts from live engine output.

### Accounts are optional, and must stay that way

`lib/supabase.ts` exports `null` when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are
unset, rather than throwing. Basis must generate, explore and export with no backend â€” a
missing key can never break the core product. The account UI hides itself when unconfigured
instead of offering a sign-in that cannot work.

`SystemStoreProvider` is the only place that chooses between `localSystemStore` and
`createRemoteSystemStore`. Nothing below it knows which store it got.

Security notes that are not optional:

- **Only the anon key belongs in the client.** It is public by design; RLS is what protects
  the data. The service_role key bypasses RLS and must never sit behind a `VITE_` prefix,
  since anything so prefixed is compiled into the bundle.
- `supabase/schema.sql` denies by default and scopes every policy to `auth.uid()`, split per
  operation so widening one verb cannot silently widen the rest.
- Auth is **passwordless** (magic link + OAuth). No password field, no reset flow, nothing to
  leak. Do not add password auth "for convenience".
- The sign-in response is identical whether or not the address has an account â€” otherwise the
  form becomes an email-enumeration oracle.

### Share links

`/s?p=fintech&i=payments&k=mobile,trustworthy&r=Nigeria` carries the input in readable query
params and regenerates on arrival. No backend, no stored rows, no expiry. Keep them readable
rather than base64: an opaque blob is the wrong trade for a tool whose point is explaining
itself.

### Two CSS variable namespaces that must never mix

- `--app-*` â€” the application's own chrome, defined once in `src/styles/tokens.css`
- `--ds-*` â€” the *generated* system, set as inline style on a scoped wrapper
  (`lib/designSystemVars.ts`, `components/result/DesignSystemScope.tsx`)

A generated palette must never leak into the app's chrome or vice versa. Both dark selectors
(`[data-theme='dark']` and the `prefers-color-scheme` default) read the same tokens â€” define
shared values once and reference them, rather than duplicating (they have silently drifted
apart before).

## Conventions this codebase actually enforces

**Say what is measured, and nothing more.** This is a product about honest reasoning, so the
code is held to the same standard:

- No invented confidence percentages. BM25 scores are not normalised or comparable across
  domains, so match strength is expressed as labels (`Strong / Good / Weak / Fallback`) â€”
  see `engine/matchQuality.ts`.
- Every token carries an `origin`: `generated` (from the dataset), `derived` (computed from a
  generated value), or `default` (a Basis constant because the dataset has no such role).
  Never present a derived or defaulted value as generated.
- Fallbacks are surfaced, never silent.
- Recommendations that the dataset does not contain â€” the interface patterns in
  `productPatterns.ts` â€” are labelled as guidance, not as engine output.
- Basis has no integration with Claude Code, Cursor or v0. The AI outputs are copyable text,
  and a test asserts the generated text never implies otherwise.
- Features that cannot be built honestly are absent, not stubbed. There is no screenshot
  upload, because there is no image analysis.

**Contrast is measured, not eyeballed.** Anything that changes a background or text colour
gets checked with `engine/color.ts` (`contrastRatio`, `wcagLevel`) before it lands. For
gradients, rasterise the layers and read the extreme pixel â€” the flat base colour is not the
worst case. `engine/ground.ts` solves its own wash strength against this rule and holds a
`SAFETY_MARGIN` so float noise cannot push the result under; its guarantee is re-derived
independently in `ground.test.ts` rather than trusting the solver.

**Accessibility floor:** visible focus rings, 44px touch targets on coarse pointers,
`prefers-reduced-motion` respected, no horizontal page scroll at 360px.

## Known gaps

- `region` on `GenerateInput` is accepted and echoed but deliberately kept out of the search
  query - feeding it to BM25 would break parity. A test pins this. It is now the only input
  that genuinely does nothing.
- The dataset still loads in full once someone generates; it is deferred, not reduced.

## Settled, not gaps

- **`industry` is not underweighted.** Measured across 55 product x industry combinations,
  it steers the category in 49. In the other 6 the product type wins, and it should:
  weighting industry higher would turn a fashion designer's portfolio into a wardrobe
  planner. `industry.test.ts` pins both behaviours. Field order carrying no meaning is a
  property of bag-of-words matching, not an oversight.
