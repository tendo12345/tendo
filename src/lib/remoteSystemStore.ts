import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerateInput } from '../engine/types';
import type { SavedSystem, SystemStore, SystemStoreInfo } from './systemStore';

/**
 * Account-backed implementation of the saved-systems port.
 *
 * Same interface as `localSystemStore`, so every screen that saves is unchanged — which is
 * the entire reason the port was written before the backend existed.
 *
 * `user_id` is set from the session rather than passed in by a caller. RLS would reject a
 * mismatched id anyway, but setting it in one place means a call site cannot get it wrong
 * and discover the problem as a confusing policy error.
 */

export const accountStoreInfo: SystemStoreInfo = {
  kind: 'account',
  description: 'Saved to your account. They sync to any browser you sign in from.',
};

interface Row {
  id: string;
  name: string;
  input: GenerateInput;
  engine_version: string;
  output_hash: string;
  created_at: string;
}

function toSaved(row: Row): SavedSystem {
  return {
    id: row.id,
    name: row.name,
    input: row.input,
    engineVersion: row.engine_version,
    outputHash: row.output_hash,
    createdAt: row.created_at,
  };
}

export function createRemoteSystemStore(client: SupabaseClient, userId: string): SystemStore {
  return {
    async list() {
      const { data, error } = await client
        .from('saved_systems')
        .select('id, name, input, engine_version, output_hash, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Row[]).map(toSaved);
    },

    async get(id) {
      const { data, error } = await client
        .from('saved_systems')
        .select('id, name, input, engine_version, output_hash, created_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toSaved(data as Row) : null;
    },

    async save(input, name, fingerprint) {
      const { data, error } = await client
        .from('saved_systems')
        .insert({
          user_id: userId,
          name: name.trim() || input.productType,
          input,
          engine_version: fingerprint.engineVersion,
          output_hash: fingerprint.outputHash,
        })
        .select('id, name, input, engine_version, output_hash, created_at')
        .single();
      if (error) throw new Error(error.message);
      return toSaved(data as Row);
    },

    async rename(id, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      const { error } = await client.from('saved_systems').update({ name: trimmed }).eq('id', id);
      if (error) throw new Error(error.message);
    },

    async remove(id) {
      const { error } = await client.from('saved_systems').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Copy local systems into an account, skipping ones already there.
 *
 * Runs on request, not automatically on sign-in: silently uploading someone's local work the
 * moment they authenticate is a decision they should make, not one made for them. Local rows
 * are left in place afterwards so a failed upload cannot lose anything.
 */
export async function uploadLocalSystems(
  remote: SystemStore,
  local: SavedSystem[],
): Promise<{ uploaded: number; skipped: number }> {
  const existing = await remote.list();
  const seen = new Set(existing.map((r) => JSON.stringify(r.input)));

  let uploaded = 0;
  let skipped = 0;

  for (const row of local) {
    if (seen.has(JSON.stringify(row.input))) {
      skipped++;
      continue;
    }
    await remote.save(row.input, row.name, {
      engineVersion: row.engineVersion,
      outputHash: row.outputHash,
    });
    seen.add(JSON.stringify(row.input));
    uploaded++;
  }

  return { uploaded, skipped };
}
