// @vitest-environment jsdom

/**
 * When AuthProvider loads supabase-js, and when it must not.
 *
 * The weight saving is only real if a signed-out visitor never triggers the load. The
 * correctness is only intact if every visitor who needs it does: a stored session must be
 * restored, a sign-in callback must be completed, and a sign-in in another tab must reach
 * this one. Each is pinned here against a stand-in client, so the test measures the
 * provider's decisions rather than the network.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: string, session: unknown) => void;

const env = vi.hoisted(() => ({ pending: false }));
const fake = vi.hoisted(() => {
  const listeners: Listener[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null as unknown } })),
      onAuthStateChange: vi.fn((cb: Listener) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    })),
  };
  return { client, listeners, load: vi.fn(async () => client) };
});

vi.mock('../lib/supabase', () => ({
  accountsEnabled: () => true,
  hasPendingAuth: () => env.pending,
  isAuthStorageKey: (k: string) => /^sb-.+-auth-token$/.test(k),
  loadSupabase: fake.load,
}));

import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const { status, client } = useAuth();
  return (
    <p data-testid="probe">
      {status}|{client ? 'client' : 'none'}
    </p>
  );
}

const probe = () => screen.getByTestId('probe').textContent;

function mount() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    env.pending = false;
    fake.load.mockClear();
    fake.client.auth.getSession.mockImplementation(async () => ({ data: { session: null } }));
    fake.listeners.length = 0;
  });

  afterEach(() => cleanup());

  it('reads a signed-out visitor as signed out on the first render, and never loads the library', async () => {
    mount();
    expect(probe()).toBe('signed-out|none');
    await act(async () => {});
    expect(fake.load).not.toHaveBeenCalled();
  });

  it('restores a stored session: loads the library and reports signed in', async () => {
    env.pending = true;
    const session = { user: { id: 'u1' } };
    fake.client.auth.getSession.mockImplementation(async () => ({ data: { session } }));
    mount();
    // Unresolved until the library has answered — never "signed-out" in the meantime, which
    // would bounce a signed-in visitor off a guarded route.
    expect(probe()).toBe('loading|none');
    await act(async () => {});
    expect(fake.load).toHaveBeenCalled();
    expect(probe()).toBe('signed-in|client');
  });

  it('loads the library when another tab signs in, so this one stops showing "Log in"', async () => {
    mount();
    expect(fake.load).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'sb-ref-auth-token', newValue: '{}' }));
    });
    expect(fake.load).toHaveBeenCalled();
    expect(probe()).toBe('signed-out|client');
    // Once loaded, auth changes flow through the library's own listener.
    await act(async () => {
      fake.listeners.forEach((cb) => cb('SIGNED_IN', { user: { id: 'u2' } }));
    });
    expect(probe()).toBe('signed-in|client');
  });

  it('ignores storage events that are not a session', async () => {
    mount();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'basis-saved-systems', newValue: '[]' }));
    });
    expect(fake.load).not.toHaveBeenCalled();
  });

  it('loads the library on demand for code that needs it signed out', async () => {
    let ensure: (() => Promise<unknown>) | null = null;
    function Grab() {
      ensure = useAuth().ensureClient;
      return null;
    }
    render(
      <AuthProvider>
        <Grab />
        <Probe />
      </AuthProvider>,
    );
    expect(fake.load).not.toHaveBeenCalled();
    await act(async () => {
      await ensure!();
    });
    expect(fake.load).toHaveBeenCalled();
    expect(probe()).toBe('signed-out|client');
  });
});
