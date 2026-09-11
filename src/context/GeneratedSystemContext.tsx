import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DesignSystemOutput } from '../engine/types';

/*
  This provider holds the current system. It does NOT generate one, and it must never import
  the engine.

  It is mounted at the root (main.tsx), so everything it imports ships on first load. It used
  to import `generateDesignSystem`, which pulled the engine and the whole ~100 kB gzipped
  dataset into the entry chunk for every visitor — including the ones who read the landing
  page and leave. CLAUDE.md said the dataset was not part of first load; from the initial
  commit until this was fixed, it always was.

  Generation lives in hooks/useGenerate.ts instead, imported only by the routes that generate
  (Generator, Share, Workspace), which are lazily loaded — so the engine arrives with them.
  firstLoad.test.ts walks the static import graph from main.tsx and fails if the dataset
  becomes reachable again.
*/

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
  /** Make `system` the current one. Called by useGenerate with fresh engine output. */
  show: (system: DesignSystemOutput) => void;
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

  const show = useCallback((system: DesignSystemOutput) => {
    setOutput(system);
    setGeneratedAt(new Date().toISOString());
  }, []);

  const clear = useCallback(() => {
    setOutput(null);
    setGeneratedAt(null);
  }, []);

  const value = useMemo(
    () => ({ output, generatedAt, show, clear }),
    [output, generatedAt, show, clear],
  );

  return <GeneratedSystemContext.Provider value={value}>{children}</GeneratedSystemContext.Provider>;
}

export function useGeneratedSystem(): GeneratedSystemContextValue {
  const ctx = useContext(GeneratedSystemContext);
  if (!ctx) throw new Error('useGeneratedSystem must be used within GeneratedSystemProvider');
  return ctx;
}
