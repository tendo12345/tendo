/** App-level types for the generator UI. Never re-export or shadow anything from `src/engine/types.ts`. */

export interface GeneratorFormState {
  productType: string;
  industry: string;
  keywords: string[];
  region: string;
}

export type ToastTone = 'default' | 'success' | 'error';

export interface ToastMessage {
  id: string;
  text: string;
  tone: ToastTone;
}

export type Theme = 'light' | 'dark';

export interface ResultSection {
  id: string;
  label: string;
}

export interface WorkspaceSection {
  /** URL segment under /system. */
  id: string;
  label: string;
}

/**
 * The workspace's secondary navigation.
 *
 * Only sections that actually exist are listed. Patterns, Accessibility and Code are
 * planned but unbuilt, and listing them as empty tabs would be the fake completeness the
 * brief rules out.
 */
export const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'colors', label: 'Colors' },
  { id: 'modes', label: 'Light & dark' },
  { id: 'typography', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'components', label: 'Components' },
  { id: 'states', label: 'States' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'explore', label: 'Explore' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'preview', label: 'Preview' },
  { id: 'ai', label: 'Build with AI' },
  { id: 'import', label: 'Import' },
  { id: 'export', label: 'Export' },
];

export const RESULT_SECTIONS: ResultSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'components', label: 'Components' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'export', label: 'Export' },
];
