#!/usr/bin/env python3
"""
Capture ground truth from the Python ui-ux-pro-max engine.

The TS port is validated against the output of this script. Run it against the skill
revision the port targets (commit 7538cfb, the one installed via Claude Desktop):

    python scripts/capture-ground-truth.py \
        --skill-scripts <path-to>/ui-ux-pro-max/scripts \
        --set validation \
        --out src/engine/__tests__/fixtures/python-ground-truth.json

Sets:
    validation   the four queries named in the Phase 1 brief
    holdout      30 ordinary queries the port was never tuned against
    adversarial  30 edge cases: unicode, punctuation, single tokens, no-match queries

The output maps query string -> the dict returned by DesignSystemGenerator.generate().
"""

import argparse
import json
import os
import sys

VALIDATION = [
    "general purpose app clean",
    "fintech mobile trustworthy",
    "portfolio minimal editorial",
    "saas dashboard dark",
    "crypto wallet emerging market",
]

HOLDOUT = [
    "ecommerce fashion luxury", "healthcare patient booking calm", "gaming arcade neon",
    "education kids playful", "real estate listings premium", "restaurant menu warm",
    "music streaming immersive", "legal firm authority", "travel booking adventure",
    "crypto nft marketplace bold", "insurance claims clarity", "fitness tracker energetic",
    "podcast player minimal", "nonprofit donation trust", "logistics tracking operational",
    "dating app playful", "banking mobile secure nigeria", "developer tools terminal dark",
    "meditation calm soft", "news editorial serif", "agency portfolio brutalist",
    "invoice saas clean", "pharmacy delivery friendly", "weather app glassmorphism",
    "coworking space modern", "bakery storefront cozy", "vpn privacy technical",
    "kids learning colorful", "car marketplace sleek", "charity campaign hopeful",
]

ADVERSARIAL = [
    "zzzz", "a", "ui", "the and but", "e-commerce b2b", "co-working space", "fin-tech",
    "SaaS DASHBOARD", "app", "design", "xyzzy qwerty flurb", "mobile", "dark", "crypto",
    "portfolio", "health", "naïve café brand", "日本語 アプリ", "emoji 🚀 startup",
    "re:invent 2025", "c++ tooling", "node.js api docs", "a b c d e f g",
    "very long query about a fintech mobile banking application for first time users of "
    "digital money in emerging markets like nigeria",
    "AI/ML platform", "non-profit", "24/7 support portal", "x", "user's dashboard",
    "don't panic app",
]

SETS = {"validation": VALIDATION, "holdout": HOLDOUT, "adversarial": ADVERSARIAL}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill-scripts", required=True,
                        help="path to the skill's scripts/ directory (holds design_system.py)")
    parser.add_argument("--set", dest="query_set", choices=sorted(SETS), default="validation")
    parser.add_argument("--out", required=True, help="output JSON path")
    args = parser.parse_args()

    scripts_dir = os.path.abspath(args.skill_scripts)
    if not os.path.exists(os.path.join(scripts_dir, "design_system.py")):
        print(f"design_system.py not found in {scripts_dir}", file=sys.stderr)
        return 1

    # The skill's modules import each other by bare name and resolve data via __file__,
    # so both sys.path and cwd have to point at the scripts directory.
    sys.path.insert(0, scripts_dir)
    os.chdir(scripts_dir)
    from design_system import DesignSystemGenerator  # noqa: E402

    generator = DesignSystemGenerator()
    out = {}
    for query in SETS[args.query_set]:
        try:
            out[query] = generator.generate(query)
        except Exception as exc:  # captured rather than raised, so one bad query is visible
            out[query] = {"__error__": f"{type(exc).__name__}: {exc}"}

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)

    errors = sum(1 for v in out.values() if "__error__" in v)
    print(f"wrote {len(out)} queries from set '{args.query_set}' to {out_path} ({errors} errored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
