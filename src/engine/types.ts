/** A raw data row. Keys are the original CSV column headers, verbatim. */
export type Row = Record<string, string>;

export type Domain = 'style' | 'color' | 'landing' | 'product' | 'typography';

export interface SearchResult {
  domain: Domain;
  query: string;
  file: string;
  count: number;
  results: Row[];
  /** BM25 score behind each returned row. Observational only. */
  scores?: number[];
  /** Best score that did not make the cut, or 0. Used to judge how decisive a match was. */
  runnerUpScore?: number;
  /** Rows that scored but were refused by a domain rule — the script pairings in typography. */
  excluded?: string[];
}

/** How one domain's row was arrived at. Facts about the run, not judgements about it. */
export interface DomainProvenance {
  /** False when the search returned nothing and a documented default was substituted. */
  matched: boolean;
  /** BM25 score of the selected row, when one was selected by search. */
  score?: number;
  /** Best score that lost, for judging how close the call was. */
  runnerUp?: number;
}

/**
 * How the palette was arrived at. `category` means it was read from the colours row named
 * after the product category — the two files share that key — rather than ranked by search.
 */
export type PaletteSelectionPath = 'category' | 'search' | 'none';

export type StyleSelectionPath =
  | 'exact-match'
  | 'name-match'
  | 'keyword-score'
  | 'top-ranked'
  | 'none';

/**
 * A structured record of how this result came about, so the UI never has to parse prose or
 * guess whether a value was matched or defaulted. Additive: nothing here feeds back into
 * selection.
 */
export interface Provenance {
  product: DomainProvenance;
  colors: DomainProvenance & { path: PaletteSelectionPath };
  typography: DomainProvenance & {
    /** Script-specific pairings that scored on an incidental word and were refused. */
    excluded?: string[];
  };
  pattern: DomainProvenance;
  style: DomainProvenance & {
    path: StyleSelectionPath;
    matchedPriority?: string;
    /** Set when the reasoning data named a style that does not exist and was corrected. */
    aliasedFrom?: string;
    priorities: string[];
  };
  /** Which reasoning row matched the product category, and how. */
  reasoningRule: { category: string | null; matchKind: 'exact' | 'partial' | 'keyword' | 'none' };
  tokens: {
    radius: 'style' | 'default';
    spacing: 'style' | 'default';
    motion: 'style' | 'default';
  };
}

export interface GenerateInput {
  productType: string;
  industry?: string;
  keywords: string[];
  /**
   * Emerging-market preset lane. Accepted and echoed on the output, but deliberately NOT
   * fed into the search query yet: doing so would shift BM25 scores and break parity with
   * the Python engine. See PORTING-NOTES.md, open question 3.
   */
  region?: string;
}

/** Why a given choice was made. `evidence` holds the raw source values behind it. */
export interface Reasoning {
  decision: string;
  why: string;
  source: string;
  evidence?: Record<string, string>;
}

export interface PatternOutput {
  name: string;
  sections: string;
  cta_placement: string;
  color_strategy: string;
  conversion: string;
}

export interface StyleOutput {
  name: string;
  type: string;
  effects: string;
  keywords: string;
  best_for: string;
  performance: string;
  accessibility: string;
  light_mode: string;
  dark_mode: string;
}

export interface ColorsOutput {
  primary: string;
  on_primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  destructive: string;
  ring: string;
  notes: string;
  /** Legacy aliases kept by the Python source for MASTER.md. */
  cta: string;
  text: string;
}

export interface TypographyOutput {
  heading: string;
  body: string;
  mood: string;
  best_for: string;
  google_fonts_url: string;
  css_import: string;
}

export interface SpacingScale {
  token: string;
  px: string;
  rem: string;
  usage: string;
}

export interface ShadowScale {
  token: string;
  value: string;
  usage: string;
}

export interface RadiusScale {
  token: string;
  value: string;
  usage: string;
}

export interface ComponentTokens {
  button: { radius: string; padding: string; fontWeight: string; transition: string };
  card: { radius: string; padding: string; shadow: string; transition: string };
  input: { radius: string; padding: string; fontSize: string; borderColor: string };
  modal: { radius: string; padding: string; shadow: string; maxWidth: string };
}

/** The shape the Python `DesignSystemGenerator.generate()` returns, field for field. */
export interface PythonParityOutput {
  project_name: string;
  category: string;
  pattern: PatternOutput;
  style: StyleOutput;
  colors: ColorsOutput;
  typography: TypographyOutput;
  key_effects: string;
  anti_patterns: string;
  decision_rules: Record<string, string>;
  severity: string;
}

export interface DesignSystemOutput extends PythonParityOutput {
  /** Optional handle for a future "save this result" feature. Nothing generates it yet. */
  id?: string;
  input: GenerateInput;
  /** The single string actually handed to BM25, for debugging parity with the CLI. */
  query: string;
  spacing: SpacingScale[];
  radius: RadiusScale[];
  shadows: ShadowScale[];
  components: ComponentTokens;
  /** Transition duration, taken from the style where it declares one. */
  motion: { duration: string; source: 'style' | 'default' };
  /** The page ground derived from this palette. See engine/ground.ts. */
  ground: import('./ground').Ground;
  /** How each decision was reached. Read by the UI to show match strength and fallbacks. */
  provenance: Provenance;
  reasoning: {
    category: Reasoning;
    pattern: Reasoning;
    style: Reasoning;
    colors: Reasoning;
    typography: Reasoning;
    effects: Reasoning;
    spacing: Reasoning;
    components: Reasoning;
    antiPatterns: Reasoning;
  };
}
