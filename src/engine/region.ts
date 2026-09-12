/**
 * What `region` is for.
 *
 * It stays out of the BM25 query on purpose — feeding it in would shift ranking and break
 * parity with the Python original, and "Nigeria" is not a style keyword. So for a long time
 * it was accepted, echoed, and used for nothing.
 *
 * It earns its place here instead, doing the one thing a region genuinely determines that
 * the rest of the engine cannot see: **whether the generated typography can render the
 * language at all.**
 *
 * The engine picks fonts on style and mood. Ask for a fintech app and it returns IBM Plex
 * Sans, which is correct — and which has no Arabic glyphs, no CJK, no Devanagari. A design
 * system whose fonts cannot display its own product's language is broken in a way no
 * contrast check would catch, and the dataset already carries the fix: eight script-specific
 * pairings sitting unused because nothing ever asks for them.
 *
 * Everything here is either read off the dataset or flagged as guidance. No scores, and no
 * claim that the engine "chose" a region-aware system when it did not.
 */

import typographyData from '../data/typography.json';
import type { DesignSystemOutput, Row } from './types';

const TYPOGRAPHY = typographyData as Row[];

export type Script = 'Latin' | 'Arabic' | 'Hebrew' | 'CJK-JP' | 'CJK-KR' | 'CJK-SC' | 'CJK-TC' | 'Thai' | 'Vietnamese';

export type TextDirection = 'ltr' | 'rtl';

export interface RegionProfile {
  /** The region as the user typed it. */
  input: string;
  /** False when the region is not in the table below — nothing is guessed from it. */
  recognised: boolean;
  script: Script;
  direction: TextDirection;
  /** Delivery conditions worth designing for, where they are well established. */
  context: string[];
}

/**
 * Regions, their dominant script, and delivery conditions.
 *
 * Deliberately a short, explicit table rather than a locale library. A wrong guess here
 * produces confidently wrong advice about someone's market, which is worse than saying
 * nothing — so an unrecognised region returns `recognised: false` and this module then
 * declines to advise.
 *
 * `context` is only populated where the constraint is well documented and design-relevant,
 * not for every country. It is guidance, and the UI labels it as such.
 */
const REGIONS: Array<{ match: string[]; script: Script; direction: TextDirection; context: string[] }> = [
  {
    match: ['nigeria', 'kenya', 'ghana', 'uganda', 'tanzania', 'ethiopia', 'africa', 'west africa', 'east africa'],
    script: 'Latin',
    direction: 'ltr',
    context: [
      'Android dominates, often on low-end hardware — budget for slow paint and limited memory.',
      'Mobile data is metered and expensive; every kilobyte shipped is a cost to the user.',
      'Screens are frequently used in bright sunlight, where AA contrast is not enough.',
      'Connections drop. Offline and retry states are core flows, not edge cases.',
    ],
  },
  {
    match: ['india', 'bangladesh', 'pakistan', 'sri lanka', 'south asia'],
    script: 'Latin',
    direction: 'ltr',
    context: [
      'Very wide device range; the low end is slow and memory-constrained.',
      'Multilingual by default — layouts must survive text expansion and script switching.',
      'Data cost and patchy connectivity make offline behaviour a primary flow.',
    ],
  },
  {
    match: ['indonesia', 'philippines', 'vietnam', 'southeast asia'],
    script: 'Latin',
    direction: 'ltr',
    context: [
      'Mobile-first to the point of mobile-only; desktop is the edge case.',
      'Low-end Android is common, and data is metered.',
    ],
  },
  {
    match: ['brazil', 'mexico', 'colombia', 'argentina', 'latin america', 'latam'],
    script: 'Latin',
    direction: 'ltr',
    context: [
      'Portuguese and Spanish run noticeably longer than English — leave room in labels and buttons.',
      'Mobile-first, with a wide device range.',
    ],
  },
  {
    match: ['uae', 'saudi', 'saudi arabia', 'egypt', 'qatar', 'kuwait', 'middle east', 'arabic'],
    script: 'Arabic',
    direction: 'rtl',
    context: [
      'Right-to-left: layout, icons with direction, and progress all mirror.',
      'Arabic text needs more line height than Latin at the same size.',
    ],
  },
  { match: ['israel', 'hebrew'], script: 'Hebrew', direction: 'rtl', context: ['Right-to-left: layout and directional icons mirror.'] },
  { match: ['japan', 'japanese'], script: 'CJK-JP', direction: 'ltr', context: ['Dense information is expected rather than avoided.'] },
  { match: ['korea', 'south korea', 'korean'], script: 'CJK-KR', direction: 'ltr', context: [] },
  { match: ['china', 'mainland china', 'simplified chinese'], script: 'CJK-SC', direction: 'ltr', context: [] },
  { match: ['taiwan', 'hong kong', 'traditional chinese'], script: 'CJK-TC', direction: 'ltr', context: [] },
  { match: ['thailand', 'thai'], script: 'Thai', direction: 'ltr', context: ['Thai has no spaces between words and needs extra line height.'] },
  { match: ['vietnam only', 'vietnamese'], script: 'Vietnamese', direction: 'ltr', context: ['Vietnamese stacks diacritics; tight line height clips them.'] },
];

/** Which dataset pairing serves each non-Latin script. Names are verbatim from typography.json. */
/**
 * The dataset's script-specific pairings, by script.
 *
 * Exported because typography selection needs the same list: a pairing built for Simplified
 * Chinese must not be handed to a product that never asked for it. See the gate in search.ts.
 */
export const SCRIPT_PAIRING: Partial<Record<Script, string>> = {
  Arabic: 'Arabic Elegant',
  Hebrew: 'Hebrew Modern',
  'CJK-JP': 'Japanese Elegant',
  'CJK-KR': 'Korean Modern',
  'CJK-SC': 'Chinese Simplified',
  'CJK-TC': 'Chinese Traditional',
  Thai: 'Thai Modern',
  Vietnamese: 'Vietnamese Friendly',
};

export function profileRegion(region: string): RegionProfile {
  const input = region.trim();
  const needle = input.toLowerCase();

  const hit = REGIONS.find((r) => r.match.some((m) => needle === m || needle.includes(m)));
  if (!hit) {
    return { input, recognised: false, script: 'Latin', direction: 'ltr', context: [] };
  }
  return { input, recognised: true, script: hit.script, direction: hit.direction, context: hit.context };
}

export interface RegionAssessment {
  profile: RegionProfile;
  /** Null when no region was given, or it was not recognised. */
  typography: {
    /** True when the generated pairing can render the region's script. */
    coversScript: boolean;
    currentPairing: string;
    /** The dataset pairing that does cover it, when one exists. */
    suggestion: { name: string; heading: string; body: string } | null;
    note: string;
  } | null;
  /** Set only for RTL regions, where it changes layout rather than decoration. */
  direction: { value: TextDirection; note: string } | null;
  /** Delivery-context advice. Basis guidance, never presented as engine output. */
  guidance: string[];
  isGuidance: true;
}

/**
 * Assess a generated system against its region.
 *
 * Returns nulls rather than reassurances when there is nothing to say: no region given, or a
 * region not in the table. Silence is the honest output there.
 */
export function assessRegion(output: DesignSystemOutput): RegionAssessment | null {
  const region = output.input.region?.trim();
  if (!region) return null;

  const profile = profileRegion(region);

  if (!profile.recognised) {
    return {
      profile,
      typography: null,
      direction: null,
      guidance: [
        `Basis does not recognise "${profile.input}", so it has nothing region-specific to tell you. Nothing about your system was changed by it.`,
      ],
      isGuidance: true,
    };
  }

  const pairingName = TYPOGRAPHY.find(
    (t) => t['Heading Font'] === output.typography.heading && t['Body Font'] === output.typography.body,
  )?.['Font Pairing Name'] ?? `${output.typography.heading} / ${output.typography.body}`;

  const wanted = SCRIPT_PAIRING[profile.script];
  const covers = profile.script === 'Latin' || pairingName === wanted;

  const suggestionRow = wanted ? TYPOGRAPHY.find((t) => t['Font Pairing Name'] === wanted) : undefined;

  return {
    profile,
    typography: {
      coversScript: covers,
      currentPairing: pairingName,
      suggestion:
        covers || !suggestionRow
          ? null
          : {
              name: suggestionRow['Font Pairing Name'],
              heading: suggestionRow['Heading Font'],
              body: suggestionRow['Body Font'],
            },
      note: covers
        ? profile.script === 'Latin'
          ? `${pairingName} covers Latin script, which this region uses.`
          : `${pairingName} covers ${profile.script}.`
        : `${pairingName} has no ${profile.script} glyphs. The engine selects typography by style and mood, not by language, so it cannot know your product needs them — text in this region's script would fall back to whatever the device substitutes.`,
    },
    direction:
      profile.direction === 'rtl'
        ? {
            value: 'rtl',
            note: 'This region reads right-to-left. Mirror layout, directional icons and progress indicators; the generated tokens are direction-agnostic but your components are not.',
          }
        : null,
    guidance: profile.context,
    isGuidance: true,
  };
}
