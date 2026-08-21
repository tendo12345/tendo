# Basis

**A free tool that generates a design system from one sentence, and tells you why it chose
what it chose.**

Describe what you're building — "a fintech app for first-time users in Nigeria", "a dark
analytics dashboard", "a minimal portfolio" — and Basis returns a complete starting point:
colour palette with contrast checked, a font pairing, a layout pattern, spacing and radius
tokens, component specs, and a live preview rendered in the system it just built. Every
major decision comes with the reasoning behind it, and you can export the result as CSS
variables, a Tailwind config, W3C design tokens, JSON or Markdown.

## Why it exists

Most design-system generators hand you a palette and leave. You get a result with no
argument attached, so you can't tell whether it's right for what you're building, and you
can't defend it to anyone else.

The gap isn't generation. It's justification. A design system is a set of decisions, and a
decision you can't explain isn't reusable — it's a guess you happened to write down.

So the reasoning is the product here, not a feature of it. Every choice Basis makes carries
a `why`, a `source`, and the evidence behind it:

> **Palette** — the curated set for "SaaS (General)": trust blue with an orange CTA for
> contrast, accent adjusted from `#F97316` to meet WCAG 3:1. The category calls for a
> "trust blue + accent contrast" mood.

> **Shape** — corner radius comes from Flat Design itself, which declares
> `border-radius: 2px`. Transition duration also comes from the style, `150-200ms`.

That's generated from the same data the selection used. It isn't commentary written after
the fact.

## Who it's for

Designers and developers who need a defensible starting point rather than a blank canvas —
early product work, side projects, client pitches, hackathons. It's aimed particularly at
people building for first-time users of digital products in emerging markets, where the
usual Silicon Valley defaults often don't fit.

It is a starting point, not a finished brand. It gets you to a coherent, accessible,
explainable baseline in seconds so you can spend your time on the parts that actually need
you.

## How it works

No LLM call is involved. The output is deterministic — the same input always produces the
same system, which is what makes it explainable in the first place.

1. **Match the product.** Your description is ranked against 161 product types using BM25.
2. **Load the reasoning.** The matched category has a rule row: which styles it prefers,
   what colour mood fits, which effects suit it, and what to avoid.
3. **Search each dimension.** Palette, typography and layout pattern are searched
   separately against curated datasets.
4. **Select.** Style is chosen by the category's stated priority; the rest take the best
   match.
5. **Derive and explain.** Radius, spacing and motion are read from the chosen style's own
   declared variables, then every decision is written up with its source.

Behind it sits a dataset of 161 product types, 161 palettes, 84 styles, 73 font pairings
and 34 layout patterns.

## What it doesn't do yet

Stated plainly, because a tool that explains its reasoning should also admit its limits:

- **Region is collected but unused.** The form accepts it and the output records it, but it
  doesn't yet influence the result. The regional presets are the next real feature.
- **Industry isn't weighted.** It's treated as another keyword, so it doesn't outrank a
  style word.
- **Fallbacks are quiet.** When nothing matches well, sensible defaults are substituted
  without flagging that the result is a fallback rather than a match.
- **Token coverage is partial.** Radius, spacing and motion are derived from the chosen
  style only where that style declares them — roughly a quarter of the catalogue. Everything
  else uses documented defaults, labelled as such in the output.

## Built on

The reasoning engine is a TypeScript port of the
[ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) skill by
NextLevelBuilder (MIT), pinned to commit `7538cfb`. Its dataset and matching logic do the
heavy lifting; the full licence is included at
[`licenses/ui-ux-pro-max-LICENSE.txt`](licenses/ui-ux-pro-max-LICENSE.txt).

The port is validated against the original query by query — palettes, fonts, categories and
layout patterns match it exactly. Two areas were deliberately improved: style selection now
matches on exact names rather than substrings, and spacing and radius are derived from the
chosen style instead of being identical for every result. Both changes are documented, with
the reasoning and the measurements, in [PORTING-NOTES.md](PORTING-NOTES.md).

Built with React, TypeScript and Vite. No UI framework, no analytics, no tracking.

**The engine runs entirely in your browser.** Generating a system, exploring it, checking its
contrast and exporting it all happen on your machine — nothing about what you are building is
sent anywhere, and none of it requires an account.

An optional account exists for one purpose: saving systems so they follow you between
devices. If you sign in, two things leave your browser — your email address, and the short
description you typed for each system you choose to save. Never the generated output, because
Basis stores the description and rebuilds the system from it. If you never sign in, nothing
leaves your browser at all.

## Status

Working end to end: landing page, generator, the workspace with live preview and reasoning,
and all five export formats. Accounts are built but not yet live. 295 tests, including
parity checks against the original Python engine.

Made by [Ajakaye Ayomide (@0xtendo\_)](https://oxtendo.com), a product designer working on
crypto and fintech UX for first-time users of digital money in emerging markets.
