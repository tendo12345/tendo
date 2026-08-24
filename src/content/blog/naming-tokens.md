---
title: Naming tokens without lying about them
slug: naming-tokens
date: 2026-01-15
excerpt: A token's name is a claim about where it came from. Basis labels every one as generated, derived, or default — never all three at once.
---

Every design token Basis emits carries an `origin`: `generated` when it came straight from
the matched dataset row, `derived` when it was computed from a generated value, or `default`
when the dataset simply has no such role and Basis filled the gap with a constant.

The temptation is to blur this — to present a defaulted color the same way as a generated
one, because the UI looks tidier without the distinction. We don't do that. If a value is a
guess, it says so.

This matters most at the edges: a muted text color solved against a generated background
still has to clear a contrast floor, and that floor is enforced by measurement, not by
picking a shade that looks about right.
