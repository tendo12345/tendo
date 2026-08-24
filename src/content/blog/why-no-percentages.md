---
title: Why match quality is a label, not a percentage
slug: why-no-percentages
date: 2026-01-08
excerpt: BM25 scores are not comparable across domains, so Basis reports Strong, Good, Weak or Fallback — never an invented confidence number.
---

It would be easy to take the BM25 score behind a category match and print it as "94% match."
It would also be dishonest: BM25 scores are not normalized, and a score of 12 in one domain
can mean something completely different from a score of 12 in another. There is no shared
scale to turn into a percentage.

So Basis reports match strength as one of four labels — Strong, Good, Weak, or Fallback —
derived from where a score falls relative to the distribution for that specific search, not
from a number dressed up to look more precise than it is.

Fallbacks are surfaced the same way: never silently swapped in and presented as a confident
pick.
