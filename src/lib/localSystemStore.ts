/**
 * localStorage implementation of the saved-systems port.
 *
 * Also migrates the old `basis-versions` snapshots, which stored whole `DesignSystemOutput`
 * objects. Those are exactly the rows that broke twice when the output shape changed; the
 * migration keeps only their input, which cannot go stale.
 */

import type { GenerateInput } from '../engine/types';
import type { SavedSystem, SystemStore, SystemStoreInfo } from './systemStore';

const KEY = 'basis-saved-systems';
const LEGACY_KEY = 'basis-versions';
const MAX = 200;

export const localStoreInfo: SystemStoreInfo = {
  kind: 'local',
  description: 'Saved in this browser only. They do not sync, and clearing site data removes them.',
};

function read(): SavedSystem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedSystem) : [];
  } catch {
    return [];
  }
}

function isSavedSystem(v: unknown): v is SavedSystem {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<SavedSystem>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.engineVersion === 'string' &&
    typeof s.outputHash === 'string' &&
    typeof s.input?.productType === 'string' &&
    Array.isArray(s.input?.keywords)
  );
}

function write(rows: SavedSystem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
  } catch {
    // Storage full or disabled. The current system is unaffected; only the save is lost.
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Pull inputs out of the legacy snapshot format, once.
 *
 * Legacy rows carry a whole output; only `input` survives the move. Anything without a
 * usable input is dropped rather than guessed at — a saved system that regenerates into
 * something arbitrary is worse than one that quietly did not survive an old format.
 */
export function migrateLegacySnapshots(): number {
  let legacyRaw: string | null = null;
  try {
    legacyRaw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return 0;
  }
  if (!legacyRaw) return 0;

  let migrated = 0;
  try {
    const rows: unknown = JSON.parse(legacyRaw);
    if (!Array.isArray(rows)) return 0;

    const existing = read();
    const seen = new Set(existing.map((r) => JSON.stringify(r.input)));
    const converted: SavedSystem[] = [];

    for (const row of rows) {
      const r = row as {
        id?: string;
        label?: string;
        savedAt?: string;
        output?: { input?: GenerateInput };
      };
      const input = r.output?.input;
      if (!input || typeof input.productType !== 'string') continue;
      const key = JSON.stringify(input);
      if (seen.has(key)) continue;
      seen.add(key);
      converted.push({
        id: r.id ?? newId(),
        name: r.label ?? input.productType,
        input,
        // The engine that produced them is unknown, so they are marked as such and will
        // report drift on first open rather than claiming to be current.
        engineVersion: 'legacy',
        outputHash: 'legacy',
        createdAt: r.savedAt ?? new Date().toISOString(),
      });
      migrated++;
    }

    if (converted.length > 0) write([...converted, ...existing]);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    return 0;
  }
  return migrated;
}

export const localSystemStore: SystemStore = {
  async list() {
    return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id) {
    return read().find((r) => r.id === id) ?? null;
  },

  async save(input, name, fingerprint) {
    const row: SavedSystem = {
      id: newId(),
      name: name.trim() || input.productType,
      input,
      engineVersion: fingerprint.engineVersion,
      outputHash: fingerprint.outputHash,
      createdAt: new Date().toISOString(),
    };
    write([row, ...read()]);
    return row;
  },

  async rename(id, name) {
    write(read().map((r) => (r.id === id ? { ...r, name: name.trim() || r.name } : r)));
  },

  async remove(id) {
    write(read().filter((r) => r.id !== id));
  },
};
