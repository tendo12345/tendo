/**
 * Interface patterns worth building for a given product type.
 *
 * Honest labelling matters here. The dataset does NOT contain a list of interface patterns,
 * so these are Basis recommendations keyed off the matched product category — not something
 * the engine derived. What IS from the dataset is the `Key Considerations` note, which is
 * looked up on the matched product row and attributed as such.
 *
 * The UI must present these as guidance, never as generated reasoning.
 */

import productsData from '../data/products.json';
import type { DesignSystemOutput, Row } from './types';

const PRODUCTS = productsData as Row[];

export interface PatternGroup {
  /** Which family of product these were chosen for. */
  family: string;
  /** Why this family was picked for the matched category. */
  matchedOn: string;
  patterns: string[];
  /** Verbatim from products.csv for the matched row, when it has one. */
  keyConsiderations: string | null;
  /** Always true — these are recommendations, not engine output. */
  isGuidance: true;
}

/**
 * Product families and the screens they nearly always need.
 *
 * Deliberately short lists of things that genuinely differ by family. A generic list
 * ("navigation, buttons, forms") would apply to everything and help with nothing.
 */
const FAMILIES: Array<{ family: string; match: string[]; patterns: string[] }> = [
  {
    family: 'Fintech and payments',
    match: ['fintech', 'crypto', 'bank', 'payment', 'wallet', 'insurance', 'invoice', 'lending', 'trading', 'financial'],
    patterns: [
      'Authentication and device trust',
      'Account summary and balances',
      'Transaction list with filters',
      'Send, request and confirm flow',
      'Transaction detail and receipt',
      'Security settings and 2FA',
      'Verification and KYC states',
      'Empty state: no transactions yet',
      'Error state: declined or failed payment',
    ],
  },
  {
    family: 'SaaS and internal tools',
    match: ['saas', 'dashboard', 'analytics', 'admin', 'crm', 'productivity', 'project', 'workspace', 'b2b', 'tool'],
    patterns: [
      'Dashboard with key metrics',
      'Persistent sidebar navigation',
      'Global search and command palette',
      'Data table with sorting and filters',
      'Detail drawer or split view',
      'Settings and preferences',
      'Roles and permissions',
      'Onboarding and empty first-run state',
      'Billing and plan management',
    ],
  },
  {
    family: 'E-commerce and marketplace',
    match: ['commerce', 'shop', 'store', 'retail', 'marketplace', 'fashion', 'grocery', 'food delivery', 'booking'],
    patterns: [
      'Product listing with facets',
      'Product detail and gallery',
      'Cart and cart drawer',
      'Checkout and payment',
      'Order confirmation and tracking',
      'Search and zero-results state',
      'Reviews and ratings',
      'Wishlist or saved items',
    ],
  },
  {
    family: 'Health and care',
    match: ['health', 'medical', 'clinic', 'patient', 'therapy', 'mental', 'fitness', 'pharmacy', 'dental', 'wellness'],
    patterns: [
      'Appointment booking and rescheduling',
      'Care plan or programme overview',
      'Records and history timeline',
      'Secure messaging with a provider',
      'Reminders and adherence prompts',
      'Consent and privacy controls',
      'Sensitive empty and error states',
    ],
  },
  {
    family: 'Learning and education',
    match: ['education', 'learning', 'course', 'school', 'student', 'kids', 'training', 'flashcard', 'bootcamp'],
    patterns: [
      'Course or lesson browser',
      'Lesson player and progress',
      'Quiz and feedback states',
      'Streaks, badges and progress',
      'Assignments and submissions',
      'Parent or instructor view',
      'Empty state: nothing enrolled yet',
    ],
  },
  {
    family: 'Content and media',
    match: ['media', 'news', 'blog', 'podcast', 'streaming', 'music', 'video', 'editorial', 'publishing', 'newsletter'],
    patterns: [
      'Feed or browse surface',
      'Article or player view',
      'Continue where you left off',
      'Collections and playlists',
      'Subscribe and paywall',
      'Offline and buffering states',
    ],
  },
  {
    family: 'Portfolio and marketing',
    match: ['portfolio', 'agency', 'personal', 'landing', 'marketing', 'freelancer', 'studio'],
    patterns: [
      'Hero and positioning statement',
      'Selected work grid',
      'Case study detail',
      'About and credibility',
      'Contact and enquiry form',
      'Form success and failure states',
    ],
  },
  {
    family: 'Social and community',
    match: ['social', 'community', 'chat', 'messenger', 'dating', 'forum', 'network'],
    patterns: [
      'Feed and composer',
      'Profile and settings',
      'Conversation thread',
      'Notifications',
      'Follow, block and report',
      'Moderation and safety states',
      'Empty state: no connections yet',
    ],
  },
];

/** Patterns every product needs, whatever it is. */
const UNIVERSAL: string[] = [
  'Loading and skeleton states',
  'Empty states',
  'Error and retry states',
  'Form validation and inline errors',
  'Confirmation before destructive actions',
];

export function buildProductPatterns(output: DesignSystemOutput): PatternGroup {
  const category = output.category.toLowerCase();
  const keywords = (
    PRODUCTS.find((p) => p['Product Type'] === output.category)?.['Keywords'] ?? ''
  ).toLowerCase();
  const haystack = `${category} ${keywords}`;

  const hit = FAMILIES.find((f) => f.match.some((m) => haystack.includes(m)));

  const row = PRODUCTS.find((p) => p['Product Type'] === output.category);
  const keyConsiderations = row?.['Key Considerations']?.trim() || null;

  if (!hit) {
    return {
      family: 'General product',
      matchedOn: `No specific family matched "${output.category}", so only the patterns every product needs are listed.`,
      patterns: UNIVERSAL,
      keyConsiderations,
      isGuidance: true,
    };
  }

  const matchedTerm = hit.match.find((m) => haystack.includes(m)) ?? '';

  return {
    family: hit.family,
    matchedOn: `Matched on "${matchedTerm}" in the product category and its dataset keywords.`,
    patterns: [...hit.patterns, ...UNIVERSAL],
    keyConsiderations,
    isGuidance: true,
  };
}
