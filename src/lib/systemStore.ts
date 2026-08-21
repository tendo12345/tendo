/**
 * The saved-systems port.
 *
 * One interface, swappable implementations: `localSystemStore` today, a Supabase-backed
 * store once accounts exist. Callers only ever see this interface, so adding accounts
 * becomes a swap at the provider rather than an edit to every screen that saves.
 *
 * **Every method is async even though localStorage is synchronous.** That is the whole point
 * of writing this now: if the local store were sync, every call site would be written
 * synchronously and each one would need rewriting — with its own loading and error states —
 * the day a network sits behind it. Paying that cost up front is a few `await`s; paying it
 * later is a refactor of the UI.
 *
 * A saved system stores the INPUT, not the output. See engine/version.ts for why.
 */

import type { GenerateInput } from '../engine/types';

export interface SavedSystem {
  id: string;
  name: string;
  /** The 61 bytes that regenerate the system. */
  input: GenerateInput;
  /** Engine version at save time, so drift can be detected on reload. */
  engineVersion: string;
  /** Fingerprint of the decisions at save time. */
  outputHash: string;
  createdAt: string;
}

export interface SystemStore {
  /** Newest first. */
  list(): Promise<SavedSystem[]>;
  get(id: string): Promise<SavedSystem | null>;
  save(input: GenerateInput, name: string, fingerprint: { engineVersion: string; outputHash: string }): Promise<SavedSystem>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Where a store keeps its data, for honest UI copy. */
export type StoreKind = 'local' | 'account';

export interface SystemStoreInfo {
  kind: StoreKind;
  /** Shown to the user so they know whether their systems sync. */
  description: string;
}

/**
 * Drift between a saved system and what the current engine produces from the same input.
 *
 * `unchanged` covers the common case where the engine moved but this input was unaffected —
 * worth distinguishing from `changed`, because telling every user their systems moved after
 * a release that only touched one product category would be noise.
 */
export type DriftStatus = 'current' | 'unchanged' | 'changed';

export function detectDrift(
  saved: Pick<SavedSystem, 'engineVersion' | 'outputHash'>,
  current: { engineVersion: string; outputHash: string },
): DriftStatus {
  if (saved.engineVersion === current.engineVersion) return 'current';
  return saved.outputHash === current.outputHash ? 'unchanged' : 'changed';
}
