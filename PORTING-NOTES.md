# Porting notes — Phase 1

What the TS engine is, what it is faithful to, where it deliberately diverges, and the
judgment calls still open from the Python source.

## Source

The `ui-ux-pro-max` skill installed via Claude Desktop ships **only `SKILL.md`** — no
`scripts/`, no data files. The engine was recovered from the upstream repo,
`github.com/nextlevelbuilder/ui-ux-pro-max-skill`, pinned to the commit whose `SKILL.md`
is byte-identical to the installed one:

```
7538cfb3604c83b0eb5ab570a6375ba9acd6507a  (2026-06-21)
```

Files ported from `src/ui-ux-pro-max/` at that commit:

| Source                        | Ported to                     | Rows |
| ----------------------------- | ----------------------------- | ---- |
| `data/products.csv`           | `src/data/products.json`      | 161  |
| `data/styles.csv`             | `src/data/styles.json`        | 84   |
| `data/colors.csv`             | `src/data/colors.json`        | 161  |
| `data/landing.csv`            | `src/data/landing.json`       | 34   |
| `data/typography.csv`         | `src/data/typography.json`    | 73   |
| `data/ui-reasoning.csv`       | `src/data/ui-reasoning.json`  | 161  |
| `scripts/core.py` (BM25)      | `src/engine/bm25.ts`          | —    |
| `scripts/core.py` (search)    | `src/engine/search.ts`        | —    |
| `scripts/design_system.py`    | `src/engine/designSystem.ts`  | —    |

Column names are preserved verbatim, including spaces and the `✓` in `Light Mode ✓`.
Every column is kept, not just the ones the engine reads.

Not ported (outside Phase 1): the `ux`, `icons`, `chart`, `react`, `web`, `google-fonts`
and per-stack domains; `detect_domain`; the ASCII/Markdown formatters; the `--persist`
MASTER.md writer.

## Parity

The engine was first built as a byte-identical port and validated at 65/65 queries. Two
deliberate fixes have since been applied (items 1 and 2 below), so parity is now asserted
per field rather than wholesale:

| Field group                                              | Status vs Python  |
| -------------------------------------------------------- | ----------------- |
| category, colors, typography, pattern, anti-patterns, decision rules, severity, project name | identical, 65/65 |
| style, key_effects                                        | differs on 16/65, all reviewed |

Every style difference is recorded in `fixtures/intended-divergence.json` with both values.
The test suite asserts the new value exactly, so an unreviewed change in the matcher fails
rather than quietly rewriting the baseline. Regenerate that list with:

```bash
npx tsx scripts/capture-divergence.ts
```

and see the full picture at any time with:

```bash
npx tsx scripts/divergence.ts
```

Validation is the four queries named in the Phase 1 brief, plus `general purpose app clean`
— the industry-neutral query the README and CLI lead with, added so the advertised example
is itself parity-checked.

The holdout and adversarial sets were generated **after** the port was written and were
not used to tune it. Adversarial covers unicode (`naïve café`, `日本語 アプリ`, emoji),
punctuation (`c++`, `node.js`, `24/7`, `don't`), single tokens, and queries that match
nothing.

Regenerate any fixture:

```bash
python scripts/capture-ground-truth.py --skill-scripts <path>/ui-ux-pro-max/scripts --set holdout --out src/engine/__tests__/fixtures/python-holdout.json
```

Two tokenizer details had to be handled deliberately rather than transliterated:

- Python's `\w` under `str` covers unicode letters and digits, so the JS regex uses
  `[^\p{L}\p{N}_\s]` rather than `\W`. A naive `\W` port silently drops accented and CJK
  text and diverges on the adversarial set.
- Python's `sorted(..., reverse=True)` is stable and does **not** reverse ties. JS
  `Array.prototype.sort` is also stable, so a plain descending comparator matches. Any
  tie-break "improvement" here reorders results.

## Judgment calls found in the Python

Items 1 and 2 have been fixed. Items 3 to 6 are still open.

### 1. Spacing, radius and component specs — FIXED, now derived from the style

In the Python these are hardcoded literals inside `format_master_md()`, byte-identical for
every query: a fintech dashboard and a kids' learning app got the same 4→64px scale, the
same 8/12/16px radii, the same 200ms transition. Only the colours varied.

They are now derived from the matched style, in `src/engine/styleTokens.ts`. This is not
invention — the data was already there and the Python was throwing it away. Every one of
the 84 style rows has a `Design System Variables` cell, and many spell out exactly what
they want:

```
Brutalism     --border-radius: 0px,  --transition-duration: 0s
Flat Design   --border-radius: 2px,  --animation: minimal 150-200ms
Claymorphism  --border-radius: 20px, --border-width: 3-4px
Neumorphism   --border-radius: 14px
Data-Dense    --grid-gap: 8px, --card-padding: 12px
```

The Python reads that column into its output columns and then never uses it.

Coverage is partial and is reported honestly rather than padded. Across the 161 product
types, radius resolves from the style on 51, spacing on 36, and motion on 90. Where the
style declares nothing, the ported constants are used unchanged and the token is marked
`source: 'default'`, so a consumer can always tell a derived value from a fallback:

```ts
result.reasoning.components.evidence   // { radius: 'style', motion: 'style' }
result.motion                          // { duration: '175ms', source: 'style' }
```

Ranges collapse to their midpoint (`150-200ms` → 175ms, `16-24px` → 20px). A style
declaring `0px` stays 0px across the whole scale rather than stepping up.

### 2. Style selection substring bug — FIXED, exact match first

`_select_best_match` tested `priority in style_name or style_name in priority`, so:

- `Minimalism` matched **`Exaggerated Minimalism`**, a loud editorial style whose own
  "Best For" reads "Fashion, architecture, portfolios, luxury brands". This hit every
  fintech, crypto, banking, government, B2B and portfolio query.
- `Neumorphism` matched `Neumorphism (Mobile)`, `Claymorphism` matched
  `Claymorphism (Mobile)`, `Brutalism` matched `Kinetic Brutalism (Mobile)` — mobile-only
  variants leaking into queries with no mobile signal at all.

Measured across all 161 product types, 58 resolved through a loose substring match: 22 had
an exact style available and were overridden anyway, and 36 named a style that does not
exist in `styles.csv`.

The matcher now runs exact-match-first, and those 36 broken priority tokens are corrected
through an alias table in `src/engine/stylePriority.ts`. Result: 140 of 161 product types
now resolve by exact name, up from 102.

The corrections live in engine code, not in `src/data/ui-reasoning.json`, so the ported
JSON stays a faithful mirror of the upstream CSV and can be regenerated from a newer skill
revision without losing this work.

Six priority tokens name a style the dataset simply does not contain — `Holographic/HUD`,
`HUD/Sci-Fi FUI`, `Clean Science`, `High Imagery`, `Biomimetic/Organic 2.0`, `E-Ink/Paper`.
No target is guessed for these; they are listed in `UNRESOLVED_STYLE_PRIORITIES` and fall
through to substring then keyword scoring, exactly as before.

**One known regression.** `agency portfolio brutalist` now resolves to `Motion-Driven`
where it used to give `Neo Brutalism (Mobile)`. The `Marketing Agency` row prioritises
`Brutalism + Motion-Driven`, but plain `Brutalism` never reaches BM25's top three because
its own mobile variants outrank it (`Neo Brutalism (Mobile)`, `Kinetic Brutalism (Mobile)`),
so the matcher falls to the second priority. The root cause is mobile variants crowding the
candidate list; a `(Mobile)` de-ranking pass for queries with no mobile signal would fix it
and is not yet implemented.

### 3. `region` is accepted but not used (open)

The brief asks for `region` on the input for the emerging-market lane. The Python has no
concept of it — the CLI takes one query string. Feeding `region` into that string would
shift BM25 scores and break parity, so it is currently **echoed on the output and left out
of the query**. A test pins this behaviour so it cannot change by accident.

To make it real, it needs its own lane (a region→palette/type preset, or a post-selection
filter), which is new reasoning.

### 4. `industry` is concatenated, not weighted (open)

Same reason: the Python has one flat query, so `productType + industry + keywords` are
joined with spaces and BM25 treats every token equally. An industry term does not outrank
a style keyword. Faithful, but it means `{productType: 'saas', industry: 'healthcare'}`
and `{productType: 'healthcare', industry: 'saas'}` produce identical output.

### 5. Silent fallbacks (open)

When nothing matches, the engine quietly substitutes defaults: `Minimalism` for style,
`Inter/Inter` for type, `#2563EB` for primary, `Hero + Features + CTA` for pattern, and a
generic reasoning row. The user is never told the result is a fallback rather than a
match. The port keeps the values and surfaces the situation in the `reasoning` text, but
there is no structured `confidence` or `matched: false` flag yet. Worth adding before the
UI presents these as recommendations.

### 6. The reasoning row is matched on the product category, not the query (open)

Category comes from the single top products.csv hit, then the reasoning row is found by
exact → substring → any-word match against that category string. A weak product match
therefore silently steers style, colour mood, effects and anti-patterns. The
`reasoning.category.why` records which of the three passes matched so this is visible.

## The `reasoning` field

The Python emits no per-decision "why" — it emits raw fields (`Anti_Patterns`,
`Decision_Rules`, `Severity`) that the skill's Markdown formatter lays out. The TS output
adds a `reasoning` block with `{ decision, why, source, evidence }` for each of: category,
pattern, style, colours, typography, effects, spacing, components, anti-patterns.

These are **generated from the same data the selection used** — the matched reasoning row,
the priority list, which selection branch fired, the BM25 outcome. No new judgments are
introduced, and none of them affect selection.

## Shape notes

- `id` is optional and never populated. It exists so a future "save this result" feature
  has somewhere to hang.
- `input` and `query` are echoed on the output so a result can be traced back to what
  produced it, and compared against the Python CLI directly.
- Everything the Python returns is present under the same key names, so
  `PythonParityOutput` can be diffed against a CLI dump with no mapping layer.

## Data size

The six JSON files total ~540 KB unminified and are imported statically, so today they
would all land in a client bundle. Phase 2 should either split them per domain, strip the
columns the engine never reads (`styles.json` alone carries 22 columns of which 16 are
used), or move the engine behind an endpoint. Not addressed here — Phase 1 is headless.

---

## Basis 2.0 — Phase A

The workspace layer. Built around the engine, not into it: `generateDesignSystem()` still
returns the same values it did before, and the parity tests still pass unchanged.

### What was added to the engine

One additive field and three derived views. None of them feed back into selection.

- **`output.provenance`** — a structured record of how each decision was reached: whether a
  domain matched at all, its BM25 score and the runner-up's, which path style selection
  took, and whether each token came from the style or a default. Added so the UI never has
  to parse reasoning prose or guess. `search()` now also reports scores, which is
  observational only — ranking and selection are untouched.
- **`matchQuality.ts`** — turns provenance into `Strong / Good / Weak / Fallback` labels.
  Deliberately never a percentage: BM25 scores are not normalised and not comparable across
  domains, so "87% confident" would be invented. What is real is whether anything matched,
  and how far the winner led — those produce the label.
- **`semanticTokens.ts`** — the semantic role layer (`color.action.primary`,
  `color.surface.raised`, …). It renames and organises; it never re-picks. Every token
  carries an origin: `generated` (the engine chose it), `derived` (computed from a generated
  value), or `default` (a Basis constant, because the dataset has no such role — success and
  warning colours are the honest examples).
- **`systemDna.ts`** — qualitative character traits, each evidenced by the engine field and
  the exact text that triggered it. No scores, because nothing here is measurable. Countable
  facts (ground, spacing step, corner, motion) are reported separately as measurements.

### Two defects found and fixed while building it

- **DNA read words out of context.** Substring matching pulled "friendly" out of "screen
  reader friendly" and labelled an accessibility-first fintech system *Playful*, and read
  "high contrast" (WCAG) as visual *Energetic*. Matching is now whole-word, the ambiguous
  terms are gone, and a trait is vetoed outright when the category's own `anti_patterns`
  forbid it — Fintech/Crypto lists "Playful design", so no fintech system can be described
  as playful.
- **Cached systems crashed the app.** `sessionStorage` held a system generated before
  `provenance` existed; restoring it threw on the missing field. The cache is now versioned
  and shape-checked, and a mismatch is discarded rather than restored. Bump `SCHEMA_VERSION`
  in `GeneratedSystemContext` whenever the output shape changes.

### Not built, deliberately

The workspace nav lists the nine sections that exist. Patterns, Accessibility and Code are
Phase B/D and are absent rather than present-and-empty. Everything from Phase B onward —
component states, accessibility audit, system health, light/dark token layer, variations,
comparison, version history, AI context, BASIS.md, import and audit — is still to do.

## Basis 2.0 — Phases B, C, D and part of E

Built on top of Phase A. The engine's selection logic is still untouched: everything below
either reads `DesignSystemOutput` or re-runs `generateDesignSystem()` unchanged.

### Phase B

- **`accessibility.ts`** — WCAG 2.1 contrast maths on the real generated values, plus focus
  visibility, input text size, touch target and motion duration. It audits only what it can
  compute; alt text, heading order, reading order and screen-reader labelling are named in
  the UI as *not checked* rather than passed, because they depend on markup this tool never
  sees.
- **`componentStates.ts`** — eight states per component, derived from the resting appearance
  by rule (hover shifts toward the far end of the ground, disabled blends into it). Each
  state reports the rule that produced it and its live contrast ratio.
- **`systemHealth.ts`** — six areas, each rated from a count: contrast pairs passing, tokens
  from the dataset vs defaulted, states staying legible, dimensions that fell back.
- **`darkMode.ts`** — the mode the engine did not generate, rebuilt around a neutral ground
  with brand hues preserved and lightness adjusted only where contrast demands. Not an
  inversion. Every colour in it is marked `derived`.
- **`productPatterns.ts`** — screens worth building. These are **Basis recommendations, not
  engine output**, and both the module and the UI say so; the dataset has no pattern list.
  The `Key Considerations` note shown alongside is verbatim from `products.csv`.

### Phase C

- **`variations.ts`** — a direction re-runs the engine with extra style keywords rather than
  post-processing the result, so a variation is a real generated system. When a direction
  changes nothing, it says so; when it moves the product category, it says that too.
- **Comparison** — any two systems diffed field by field.
- **`lib/versionStore.ts`** — snapshots in localStorage, schema-versioned the same way the
  session cache is, so a snapshot from an older output shape is dropped rather than restored
  into UI that would crash on it.

### Phase D

- **`aiContext.ts`** — three text outputs: a compact context block, `BASIS.md` for a repo,
  and a full implementation prompt per build target. All three are serialisations of the
  generated system. **Basis has no integration with Claude Code, Cursor, v0 or anything
  else**, and a test asserts the generated text never claims otherwise.

### Phase E — partly

- **`importSystem.ts`** — parses CSS custom properties, JSON, W3C design tokens and Tailwind
  theme blocks, then audits for duplicate values under different names, spacing that breaks
  its own step, radius scales with no repetition, failing text/background contrast, and
  missing semantic roles. It offers no opinion on naming or taste.
- **Not built:** comparing an imported system against the generated one, and screenshot or
  component analysis. Screenshot analysis needs image understanding this tool does not have,
  so there is no upload box pretending to accept one. The Import pane states this.

### Three bugs found by the tests while building

- **`adjustForContrast` picked its direction from a lightness threshold**, so a mid-tone
  ground read as "dark" and the function mixed toward white, which could never reach the
  target. It now tries both directions and returns the best candidate.
- **The CSS import parser was line-based**, so a single-line or minified `:root { … }` kept
  only the first declaration. It now scans the whole input.
- **Disabled states claimed to stay above 3:1 and did not.** The claim is now enforced by
  `adjustForContrast` and asserted across a sample of product types.

### Known gaps

- The bundle is ~895 kB (230 kB gzipped), dominated by the ~540 kB of ported JSON. Phase 2
  of the original plan flagged this; it still needs splitting per domain or moving behind an
  endpoint.
- Three header controls (Regenerate, Copy, Export) sit at 30px on mobile, below the 44px
  touch minimum. They predate this work and were left alone rather than restyled silently.
