import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ENGINE_VERSION, hashOutput, normalizeInput } from '../engine/version';
import type { DesignSystemOutput, GenerateInput } from '../engine/types';
import { localStoreInfo, localSystemStore, migrateLegacySnapshots } from '../lib/localSystemStore';
import { accountStoreInfo, createRemoteSystemStore } from '../lib/remoteSystemStore';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { SavedSystem, SystemStore, SystemStoreInfo } from '../lib/systemStore';

/**
 * Provides whichever saved-systems store is active.
 *
 * Today that is always the local one. When accounts land, this is the single place that
 * chooses between local and account storage — no screen below it needs to know which it got,
 * which is the reason the port exists.
 */

interface SystemStoreContextValue {
  systems: SavedSystem[];
  info: SystemStoreInfo;
  loading: boolean;
  error: string | null;
  saveCurrent: (output: DesignSystemOutput, name: string) => Promise<SavedSystem | null>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const SystemStoreContext = createContext<SystemStoreContextValue | null>(null);

/**
 * Picks the active store from the session.
 *
 * Signed in and configured → the account store. Anything else → local. This is the only
 * place in the app that knows the difference; every screen below reads the port.
 */
function useActiveStore(overrides: { store?: SystemStore; info?: SystemStoreInfo }) {
  const { user } = useAuth();

  return useMemo(() => {
    if (overrides.store) return { store: overrides.store, info: overrides.info ?? localStoreInfo };
    if (supabase && user) {
      return { store: createRemoteSystemStore(supabase, user.id), info: accountStoreInfo };
    }
    return { store: localSystemStore, info: localStoreInfo };
  }, [overrides.store, overrides.info, user]);
}

export function SystemStoreProvider({
  children,
  store: storeOverride,
  info: infoOverride,
}: {
  children: ReactNode;
  /** Test seam. Production picks the store from the session. */
  store?: SystemStore;
  info?: SystemStoreInfo;
}) {
  const { store, info } = useActiveStore({ store: storeOverride, info: infoOverride });
  const [systems, setSystems] = useState<SavedSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSystems(await store.list());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    // Legacy snapshots live in localStorage, so only convert them for the local store.
    if (info.kind === 'local') migrateLegacySnapshots();
    void refresh();
  }, [refresh, info.kind]);

  const saveCurrent = useCallback(
    async (output: DesignSystemOutput, name: string) => {
      try {
        const saved = await store.save(normalizeInput(output.input), name, {
          engineVersion: ENGINE_VERSION,
          outputHash: hashOutput(output),
        });
        await refresh();
        return saved;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [store, refresh],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await store.rename(id, name);
      await refresh();
    },
    [store, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await store.remove(id);
      await refresh();
    },
    [store, refresh],
  );

  const value = useMemo<SystemStoreContextValue>(
    () => ({ systems, info, loading, error, saveCurrent, rename, remove, refresh }),
    [systems, info, loading, error, saveCurrent, rename, remove, refresh],
  );

  return <SystemStoreContext.Provider value={value}>{children}</SystemStoreContext.Provider>;
}

export function useSystemStore(): SystemStoreContextValue {
  const ctx = useContext(SystemStoreContext);
  if (!ctx) throw new Error('useSystemStore must be used within SystemStoreProvider');
  return ctx;
}

/** Fingerprint the current output, for drift comparison against a saved row. */
export function fingerprint(output: DesignSystemOutput): {
  engineVersion: string;
  outputHash: string;
} {
  return { engineVersion: ENGINE_VERSION, outputHash: hashOutput(output) };
}

export type { GenerateInput };
