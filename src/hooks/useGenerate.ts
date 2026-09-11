import { useCallback } from 'react';
import { generateDesignSystem } from '../engine/designSystem';
import type { DesignSystemOutput, GenerateInput } from '../engine/types';
import { useGeneratedSystem } from '../context/GeneratedSystemContext';

/**
 * Generate a system and make it the current one.
 *
 * This is the ONLY place outside src/engine that imports the generator, and that is the point:
 * importing it brings the engine and the whole dataset with it (~100 kB gzipped). Only the
 * lazily loaded routes that actually generate — Generator, Share, Workspace — use this hook,
 * so the dataset arrives with them and never on first load.
 *
 * Do not import this from anything the landing page renders, or from a provider mounted in
 * main.tsx. firstLoad.test.ts fails if the dataset becomes reachable from the entry.
 *
 * Generation stays synchronous: by the time a component calling this has rendered, its route
 * chunk — engine included — has already loaded, so there is no async boundary to await and no
 * loading state to add.
 */
export function useGenerate() {
  const { output, show } = useGeneratedSystem();

  const generate = useCallback(
    (input: GenerateInput): DesignSystemOutput => {
      const result = generateDesignSystem(input);
      show(result);
      return result;
    },
    [show],
  );

  /**
   * Re-runs the engine on the current input. The engine is deterministic (BM25, no
   * randomness), so this returns an identical result unless the engine itself changed.
   */
  const regenerate = useCallback(
    (): DesignSystemOutput | null => (output ? generate(output.input) : null),
    [output, generate],
  );

  return { generate, regenerate };
}
