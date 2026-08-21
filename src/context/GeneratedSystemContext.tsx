import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { generateDesignSystem } from '../engine';
import type { DesignSystemOutput, GenerateInput } from '../engine/types';

const STORAGE_KEY = 'dsg-current-system';
const STORAGE_KEY_TIME = 'dsg-current-system-time';
const STORAGE_KEY_VERSION = 'dsg-current-system-version';

/**
 * Bump whenever `DesignSystemOutput` gains or changes a field the UI reads.
 *
 * A cached system is a snapshot of an older output shape, and restoring one into newer UI
 * crashes on the fields that did not exist yet — which is exactly what happened when
 * `provenance` was added. On a mismatch the cache is discarded instead. Cheap to lose:
 * the engine is deterministic, so regenerating gives back the identical system.
 */
const SCHEMA_VERSION = '3';

interface GeneratedSystemContextValue {
  output: DesignSystemOutput | null;
  /** When `output` was produced, UI-only (not part of the engine's output shape). */
  generatedAt: string | null;
  generate: (input: GenerateInput) => DesignSystemOutput;
  /** Re-runs the engine on the same input. The engine is deterministic (BM25, no randomness), so this returns an identical result unless the input changed. */
  regenerate: () => DesignSystemOutput | null;
  clear: () => void;
}

const GeneratedSystemContext = createContext<GeneratedSystemContextValue | null>(null);

/** Guards against a cache written by an older build with a different output shape. */
function isCurrentShape(value: unknown): value is DesignSystemOutput {
  if (!value || typeof value !== 'object') return false;
  const o = value as Partial<DesignSystemOutput>;
  return Boolean(
    o.colors &&
      o.typography &&
      o.style &&
      o.provenance?.tokens &&
      o.ground?.css &&
      o.reasoning &&
      Array.isArray(o.spacing) &&
      Array.isArray(o.radius),
  );
}

function readStored(): DesignSystemOutput | null {
  try {
    if (sessionStorage.getItem(STORAGE_KEY_VERSION) !== SCHEMA_VERSION) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY_TIME);
      return null;
    }
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Belt and braces: the version key can be lost independently of the payload.
    return isCurrentShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredTime(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY_TIME);
  } catch {
    return null;
  }
}

export function GeneratedSystemProvider({ children }: { children: ReactNode }) {
  const [output, setOutput] = useState<DesignSystemOutput | null>(readStored);
  const [generatedAt, setGeneratedAt] = useState<string | null>(readStoredTime);

  useEffect(() => {
    try {
      if (output) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(output));
        sessionStorage.setItem(STORAGE_KEY_VERSION, SCHEMA_VERSION);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY_VERSION);
      }
      if (generatedAt) sessionStorage.setItem(STORAGE_KEY_TIME, generatedAt);
      else sessionStorage.removeItem(STORAGE_KEY_TIME);
    } catch {
      // private browsing / storage disabled — the current system just won't survive a refresh
    }
  }, [output, generatedAt]);

  const generate = useCallback((input: GenerateInput) => {
    const result = generateDesignSystem(input);
    setOutput(result);
    setGeneratedAt(new Date().toISOString());
    return result;
  }, []);

  const regenerate = useCallback(() => {
    if (!output) return null;
    return generate(output.input);
  }, [output, generate]);

  const clear = useCallback(() => {
    setOutput(null);
    setGeneratedAt(null);
  }, []);

  const value = useMemo(
    () => ({ output, generatedAt, generate, regenerate, clear }),
    [output, generatedAt, generate, regenerate, clear],
  );

  return <GeneratedSystemContext.Provider value={value}>{children}</GeneratedSystemContext.Provider>;
}

export function useGeneratedSystem(): GeneratedSystemContextValue {
  const ctx = useContext(GeneratedSystemContext);
  if (!ctx) throw new Error('useGeneratedSystem must be used within GeneratedSystemProvider');
  return ctx;
}
