---
name: brand-design-references
description: Reference library of reverse-engineered DESIGN.md files for 74 well-known brands and products (Airbnb, Apple, BMW, Claude, Figma, Linear, Nike, Notion, Stripe, Tesla, Vercel, and more). Use when the user asks to build or restyle UI to look like a specific named brand/product, or asks what design tokens/colors/type a brand uses.
---

# Brand Design References

This skill bundles `DESIGN.md` files — plain-text design-system analyses (colors, type,
spacing, tone) extracted from real products — sourced from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md). Each file
follows the [DESIGN.md](https://stitch.withgoogle.com/docs/design-md/overview/) convention:
frontmatter-style metadata (`name`, `description`, `colors`, etc.) followed by prose notes on
layout, typography and interaction patterns.

## When to use this

The user names a brand and wants UI that looks like it — e.g. "make this landing page feel
like Linear", "what colors does Stripe use", "redesign this in a Notion style". Do **not**
reach for this on generic style requests ("make it minimal", "premium feel") — that's
`design-taste-frontend` or `high-end-visual-design` territory, not a specific brand.

## How to use it

1. Match the requested brand to a folder name below (case-insensitive, ignore punctuation —
   e.g. "mistral" → `mistral.ai`, "x" / "twitter" → `x.ai` is xAI, not Twitter/X the social app).
2. Read `brands/<name>/DESIGN.md` for the full token set and design notes.
3. Apply the colors/type/spacing found there to the actual task — do not just paste the file
   verbatim into the output. Cite it as "modeled on \<brand\>'s public design language" rather
   than implying it's an official or licensed asset; these are third-party reverse-engineered
   analyses, not brand kits from the companies themselves.
4. If no folder matches, say so plainly rather than improvising a guess and presenting it as
   sourced.

## Available brands

airbnb, airtable, apple, binance, bmw, bmw-m, bugatti, cal, claude, clay, clickhouse, cohere,
coinbase, composio, cursor, dell-1996, elevenlabs, expo, ferrari, figma, framer, hashicorp, hp,
ibm, intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify,
miro, mistral.ai, mongodb, nike, nintendo-2001, notion, nvidia, ollama, opencode.ai, pinterest,
playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry,
shopify, slack, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge,
together.ai, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, x.ai, zapier
