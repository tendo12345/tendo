# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Basis** — a client-side tool that generates a design system from a one-sentence product
description, and shows the reasoning behind every choice. Vite + React + TypeScript, no
backend, no accounts. See `ABOUT.md` for the product framing, `PORTING-NOTES.md` for the
engine's history and open decisions, and `DEPLOY.md` for hosting and the optional
Supabase-backed accounts setup.

The reasoning engine is a TypeScript port of the Python `ui-ux-pro-max` skill, pinned to
upstream commit `7538cfb` (MIT, `licenses/`). **`PORTING-NOTES.md` is required reading before
touching `src/engine` or `src/data`** — it records what the port is faithful to, where it
deliberately diverges, and which judgment calls are still open.

## Commands

```bash
npm run dev              # vite dev server on :5173
npm run build            # tsc -b && vite build — run before finishing
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
needs one opts in per file with a `// @vitest-environment jsdom` docblock — see
`src/hooks/useThemePreference.test.ts`. Keep it per-file: jsdom costs several seconds of
startup, and almost nothing here needs it.

`vitest.config.ts`'s `include` covers both `*.test.ts` and `*.test.tsx` — the latter exists
for component render tests written in JSX (see `src/components/blog/CommentItem.test.tsx`,
the first one). A `.test.ts` file with JSX in it is silently never collected; if a new
component test isn't running, check the extension first.

`vitest.config.ts` pins the pool to a single worker (`pool: 'threads'`,
`fileParallelism: false`). On Windows, a worker booting jsdom can miss the pool's startup
window and fail with "Timeout waiting for worker to respond" — the file never runs, which
reads like a broken test but is a cold start. Do not "fix" this by re-enabling parallel
workers.

**The single-worker setting must stay top-level.** It used to be written as
`poolOptions: { threads: { singleThread: true } }`, which **Vitest 4 removed** — the key is
still accepted, but only so the config loader can print a deprecation before discarding it.
Silently, the suite went fully parallel and all four jsdom files failed to start on every
run: `Test Files 17 passed (17)` with four unhandled pool errors above it, which reads as
green if you only look at the summary line. If a jsdom file stops running, check for a
`DEPRECATED` line in the vitest output before suspecting the test.

Two diagnostics that are not tests but answer "did I break the port?":

```bash
npx tsx scripts/divergence.ts          # every deliberate difference vs the Python, classified
npx tsx scripts/capture-divergence.ts  # REGENERATES the pinned divergence list — see below
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

`src/engine` must stay importable without a browser — the whole test suite depends on it.
Matching logic never goes in a component; components read `DesignSystemOutput` and render.

### How generation flows

`generateDesignSystem(input)` (`engine/designSystem.ts`) is pure and deterministic — same
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
— measured, 138× larger). The engine is deterministic, so the system is rebuilt on open.
That is why saved rows cannot go stale the way stored output did: shape drift crashed the app
twice (`provenance`, then `ground`).

The cost runs the other way — change selection logic and an old input regenerates into a
different system. `engine/version.ts` makes that visible rather than silent. Bump
`ENGINE_VERSION` when a change alters output for an unchanged input (not for additive
fields), and `detectDrift` separates "the engine moved but this system did not" from "this
actually changed", so a release that touched one category does not warn every user.

All saving goes through the `SystemStore` port (`lib/systemStore.ts`), implemented today by
`localSystemStore` and later by an account-backed store. **Every method is async even though
localStorage is not** — that is deliberate, so swapping in a network-backed store needs no
call-site changes.

`sessionStorage` still caches the *current* system in `GeneratedSystemContext`, and that one
does hold full output — bump its `SCHEMA_VERSION` when the output shape changes.

### Changing what the engine outputs

`src/engine/__tests__/engineVersion.test.ts` pins the fingerprint of five known queries. When
one fails, decide which happened:

- **intended** → update the hash *and* bump `ENGINE_VERSION` in `engine/version.ts`
- **accidental** → fix the code

Never update a pinned hash without bumping the version. Saved systems rebuild from their
input, so an unbumped change silently regenerates everyone's saved work with no drift
warning — that is precisely what this guards.

Derived text colours are **contrast-solved, not fixed mixes**. `fadeToward` in
`semanticTokens.ts` backs the fade off until the result clears AA plus a margin. The old flat
50% mix parked `color.text.muted` on the 4.5 line by construction, which failed outright on
some palettes and left no headroom for the generated ground (8 of 120 systems could carry a
wash; now 101 do).

### The dataset is stripped, and that is verified

`npm run data:check` reports which columns the engine never reads; `data:strip` removes them
and `data:verify` regenerates all 161 product types to prove nothing moved. The keep-list is
derived from `CSV_CONFIG`, with columns read by direct property access listed in `EXTRA` —
that list is the fragile part, which is why the verify step exists. Always run it after a
strip.

Column stripping is worth ~9 kB gzipped, not more: gzip already collapses the redundancy.
The dataset lives in its own `design-data` chunk (see `vite.config.ts`) so app deploys do
not invalidate it, and it is not part of first load: every route that reaches the engine is
lazily imported in `App.tsx`, and the landing page renders from a build-time precomputed
sample instead of importing the engine to generate one.

**That claim was false until September 2026, and nothing noticed.** `GeneratedSystemContext`
is mounted at the root in `main.tsx`, and it imported `generateDesignSystem` — so the entry
chunk pulled in the engine and all of `src/data`, and `index.html` preloaded it for every
visitor. Lazy routes cannot help when a root provider imports the thing they defer. The
provider now only holds the current system; generation lives in `hooks/useGenerate.ts`, which
only the lazy routes import. **Never import the engine from anything mounted in `main.tsx` or
rendered by the landing page.** `src/firstLoad.test.ts` walks the static import graph from
`main.tsx` and fails with the offending import chain if `src/data` becomes reachable.

Measured like for like (production build with Supabase configured, gzip -9), first load went
from 257.5 kB to 102.2 kB in two steps: the dataset came off (-> 153.6 kB), then supabase-js
(-> 102.2 kB; see "supabase-js loads on demand" below). What remains is the entry (78.1 kB),
the JSX runtime (16.2 kB) and CSS (7.9 kB). A local build without `VITE_SUPABASE_URL` behaves
differently — it dead-code-eliminates the Supabase paths — so measure with the variables set
(placeholders are fine; use a `.invalid` host so nothing reaches a real project).

Two things keep that saving from silently unwinding: `sampleSystem.ts` must import the
engine **type-only** (a value import drags the dataset back into the landing chunk), and
`sample-system.json` is excluded from the `design-data` chunk on purpose. Regenerate it
with `npm run build:sample`; a test fails if it drifts from live engine output.

### Accounts are optional, and must stay that way

`lib/supabase.ts` exports `null` when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are
unset, rather than throwing. Basis must generate, explore and export with no backend — a
missing key can never break the core product. The account UI hides itself when unconfigured
instead of offering a sign-in that cannot work.

`SystemStoreProvider` is the only place that chooses between `localSystemStore` and
`createRemoteSystemStore`. Nothing below it knows which store it got.

**supabase-js loads on demand, and a signed-out visitor never downloads it.** It is ~52 kB
gzipped and used to be created at module load in `lib/supabase.ts` — so, because the root
`AuthProvider` imports that file, every visitor paid for it before first paint. But whether a
visitor is signed out is knowable without the library: supabase-js keeps its session under
`sb-<project ref>-auth-token` in localStorage, and a sign-in callback arrives as known URL
parameters (`access_token` / `error*` in the fragment for the implicit flow this app uses,
`code` for PKCE). `hasPendingAuth()` checks exactly those — verified against the installed
auth-js, not assumed — and `AuthProvider` starts a visitor with neither as `signed-out` and
never loads the library. `loadSupabase()` (memoized: ONE client per page) is called for a
stored session, a callback URL, a sign-in in another tab (the `storage` event — the emailed
link opens a new tab), and by anything that needs the client while signed out
(`ensureClient()`: the sign-in form, blog comments). Signed-in-only code reads `client` from
`useAuth()`, which is always loaded by then because the session came from it.

Rules that keep this working: never import a value from `@supabase/supabase-js` statically
(`import type` is fine) — `src/firstLoad.test.ts` fails with the chain if you do; never strip
or rewrite the URL on `/account` before the client has loaded, since that is where it reads
the magic-link fragment; and keep session tracking in the effect keyed on `client`, not in a
one-shot callback, or StrictMode's double-mount leaves the nav blind to sign-in.
`AuthContext.test.tsx` pins when the library loads and when it must not.

Security notes that are not optional:

- **Only the anon key belongs in the client.** It is public by design; RLS is what protects
  the data. The service_role key bypasses RLS and must never sit behind a `VITE_` prefix,
  since anything so prefixed is compiled into the bundle.
- `supabase/schema.sql` denies by default and scopes every policy to `auth.uid()`, split per
  operation so widening one verb cannot silently widen the rest.
- Auth is **passwordless** (magic link + OAuth). No password field, no reset flow, nothing to
  leak. Do not add password auth "for convenience".
- The sign-in response is identical whether or not the address has an account — otherwise the
  form becomes an email-enumeration oracle.

### Share links

`/s?p=fintech&i=payments&k=mobile,trustworthy&r=Nigeria` carries the input in readable query
params and regenerates on arrival. No backend, no stored rows, no expiry. Keep them readable
rather than base64: an opaque blob is the wrong trade for a tool whose point is explaining
itself.

### Blog and comments

The blog is content, not a feature: posts are Markdown files under `src/content/blog`
(frontmatter parsed by a hand-rolled ~20-line parser in `src/lib/blog.ts`, on purpose — no
`gray-matter`/YAML for a fixed four-field shape), rendered with `marked` and injected via
`dangerouslySetInnerHTML`. That is safe there **only** because post bodies are trusted,
repo-authored files. Comment bodies are the opposite: user input, rendered as plain text
always (`CommentItem.tsx`, `white-space: pre-wrap`), never through `marked`, never through
`dangerouslySetInnerHTML`. `CommentItem.test.tsx` pins this so a future edit that accidentally
routes a comment through the Markdown path fails a test instead of shipping an XSS.

Comments are gated entirely behind `accountsEnabled()`, same as `Account.tsx` — there is no
local/offline comment store, because comments are inherently shared, multi-user data.

Two `supabase/schema.sql` details worth knowing before touching this area:

- **`is_admin()` and the report/moderation triggers are `security definer`, not incidentally.**
  A `comments` RLS policy checking the caller's role against `profiles` would otherwise be
  subject to `profiles`' own RLS as the calling user — who has no read policy on someone
  else's row — and the check would silently see nothing. Do not "simplify" these into plain
  `language sql` functions; that reintroduces the recursion/permission gap they exist to
  avoid.
- **There is no in-app way to grant the `admin` role, ever.** The first admin is a manual
  `update public.profiles set role = 'admin' where id = '<uuid>'` in the Supabase SQL editor
  (see `DEPLOY.md`). An admin-granting UI would need to be admin-gated itself — a
  bootstrapping problem deliberately left unsolved rather than half-solved.

The `/admin/comments` route's client-side `isAdmin` check is a UX nicety (hide the route
rather than show-and-reject), not the security boundary — that is the RLS policies on
`comments`. Treat any change to who can read/write a comment as a `schema.sql` change first,
a UI change second.

### The logo is one component and one generated asset set

`brand/basis-logo-master.png` is the supplied render, byte-for-byte, and it is the only place
the brand exists. Everything the interface draws is cut from it by `scripts/build-brand.py`:

```bash
python scripts/build-brand.py           # regenerate public/brand/* and public/favicon-*.png
python scripts/build-brand.py --check   # fail if a checked-in asset is stale
```

That needs Python and Pillow, which is why there is **no npm script for it** — the outputs are
checked in, so building and deploying need neither. Run it only when the master changes.

`BasisLogo` (`components/brand/`) is the single implementation: `variant` full | mark |
wordmark, `size` sm | md | lg, `theme` default | light | dark, plus `href`, `entrance` and
`responsive`. Never inline a logo anywhere else — that is how a product ends up with four
slightly different lockups.

Four things here are decisions, not defaults:

- **The art stays raster.** The mark is a shaded 3D cluster with soft bevels and per-face
  gradients. Tracing it to SVG produces a flat approximation — a different logo with the same
  silhouette — so the crispness is not worth it.
- **`full` is composed, not a third image.** The wordmark is 0.5612 of the mark's height, set
  0.1339 of that height away, with its optical centre 0.030 above the mark's. Those three
  ratios are measured off the master and live in `BasisLogo.module.css`; reproducing them in
  CSS is what keeps the lockup's proportions true at every size rather than at whichever size
  someone last exported.
- **The mark's contact shadow is removed and its colours never change.** The shadow reads as
  grounding on parchment and as a pale smudge on off-black, and it is separable because it is
  purely low alpha (blocks sit at 251-253, shadow under 60). The wordmark is the only part
  that gets a light variant, swapped by `<picture>` on `prefers-color-scheme` so exactly one
  file is fetched. A mark that repaints itself per surface is a decoration, not an identity.
- **The tagline is not in the UI lockup.** "GENERATE / REFINE / SHIP" would be a third of a
  pixel tall in a 32px bar. It stays in the master for anywhere the brand is presented large.

`brand.test.ts` reads the real PNG headers and fails if they drift from the sizes `assets.ts`
hands the browser — without that, a regenerated asset silently reflows the bar on every cold
load, since those numbers are what reserve the box before the image arrives.

**The hero is a working 3x3x3 cube in the mark's colours, and it is not a second logo.**
`BlockSculpture` builds 27 cubies in CSS 3D and runs them as a real puzzle: each twist turns
one layer a quarter turn about the cube's axis and then *commits* — positions permuted,
orientations multiplied — so the nine cubies in a layer differ every move. That is why it is
driven by one rAF loop (`cubeRig.ts`) over pure math (`cubeMechanics.ts`) rather than
keyframes, and why every face is lit from its real direction each frame: once cubies turn, a
baked "top is lighter" tone would leave one face of the cube patchwork. The loop writes
transforms and colours straight to the DOM, never React state, and stops while off screen.
Solved, the visible faces carry the mark's composition; nav, footer and favicon stay the
raster.

The choreography is a scramble that comes home to solved. A scramble plus its plain inverse
turns a layer straight back at the midpoint and at the loop seam; the sequence uses commuting
pairs at both ends to avoid it. `cubeMechanics.test.ts` proves the grid stays whole, every
pass returns to solved, no layer turns twice in a row, and a finished twist draws exactly
where its commit puts it (the snap you would otherwise see every move). The reduced-motion
path — solved, lit, and no loop at all — is proven by `BlockSculpture.render.test.tsx`,
because the preview tools cannot emulate that preference.

**No opacity inside a `preserve-3d` chain.** Chromium treats an active opacity animation as a
grouping property — and a `both` fill keeps it active forever, even at opacity 1 — which forces
`transform-style: flat`. The first hero cube shipped with a fade on every block and rendered
as flat tiles on production for its entire life; computed style reported `preserve-3d`
throughout, and freezing animations for a screenshot hid it by removing the cause. Fade the
3D context's root instead, and assemble pieces by transform. `BlockSculpture.test.ts` enforces
this against the stylesheet.

### Two CSS variable namespaces that must never mix

- `--app-*` — the application's own chrome, defined once in `src/styles/tokens.css`
- `--ds-*` — the *generated* system, set as inline style on a scoped wrapper
  (`lib/designSystemVars.ts`, `components/result/DesignSystemScope.tsx`)

A generated palette must never leak into the app's chrome or vice versa. Both dark selectors
(`[data-theme='dark']` and the `prefers-color-scheme` default) read the same tokens — define
shared values once and reference them, rather than duplicating (they have silently drifted
apart before).

## Conventions this codebase actually enforces

**Say what is measured, and nothing more.** This is a product about honest reasoning, so the
code is held to the same standard:

- No invented confidence percentages. BM25 scores are not normalised or comparable across
  domains, so match strength is expressed as labels (`Strong / Good / Weak / Fallback`) —
  see `engine/matchQuality.ts`.
- Every token carries an `origin`: `generated` (from the dataset), `derived` (computed from a
  generated value), or `default` (a Basis constant because the dataset has no such role).
  Never present a derived or defaulted value as generated.
- Fallbacks are surfaced, never silent.
- Recommendations that the dataset does not contain — the interface patterns in
  `productPatterns.ts` — are labelled as guidance, not as engine output.
- Basis has no integration with Claude Code, Cursor or v0. The AI outputs are copyable text,
  and a test asserts the generated text never implies otherwise.
- Features that cannot be built honestly are absent, not stubbed. There is no screenshot
  upload, because there is no image analysis.

**Contrast is measured, not eyeballed.** Anything that changes a background or text colour
gets checked with `engine/color.ts` (`contrastRatio`, `wcagLevel`) before it lands. For
gradients, rasterise the layers and read the extreme pixel — the flat base colour is not the
worst case. `engine/ground.ts` solves its own wash strength against this rule and holds a
`SAFETY_MARGIN` so float noise cannot push the result under; its guarantee is re-derived
independently in `ground.test.ts` rather than trusting the solver.

**Accessibility floor:** visible focus rings, 44px touch targets on coarse pointers,
`prefers-reduced-motion` respected, no horizontal page scroll at 360px.

## Known gaps

- The dataset still loads in full once someone generates; it is deferred, not reduced.

## Settled, not gaps

- **`region` does a real job, and it is not selection.** It stays out of the BM25 query —
  feeding it in would shift ranking and break parity, and "Nigeria" is not a style keyword —
  and it never changes the generated system. Both are pinned (`parity.test.ts` "leaves region
  out of the search query for now", `region.test.ts` "produces an identical system with or
  without a region"). What it drives instead is `engine/region.ts`: whether the generated
  pairing can render the region's script at all. The engine picks fonts on style and mood, so
  a fintech query returns IBM Plex Sans — correct, and with no Arabic, CJK or Devanagari
  glyphs. That is a way of being broken no contrast check catches, and the dataset already
  carries eight script-specific pairings for it. An unrecognised region returns
  `recognised: false` and says plainly that nothing was changed, rather than guessing.

- **`industry` is not underweighted.** Measured across 55 product x industry combinations,
  it steers the category in 49. In the other 6 the product type wins, and it should:
  weighting industry higher would turn a fashion designer's portfolio into a wardrobe
  planner. `industry.test.ts` pins both behaviours. Field order carrying no meaning is a
  property of bag-of-words matching, not an oversight.
