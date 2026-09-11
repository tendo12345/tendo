// @vitest-environment jsdom

/**
 * The footer's access line must be true in both deployments Basis supports.
 *
 * It said "no account required" everywhere, and stayed that way after the generator went behind
 * sign-in — true with no Supabase project, false with one. The line now reads the same switch
 * RequireAccount reads, and this pins both answers so it cannot drift from the gate again.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const enabled = vi.hoisted(() => ({ value: false }));
vi.mock('../../lib/supabase', () => ({ accountsEnabled: () => enabled.value }));

import { Footer } from './Footer';

function renderFooter() {
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
  return screen.getByText(/matched design data and rules/).textContent ?? '';
}

describe('Footer', () => {
  afterEach(() => {
    // Vitest runs without globals here, so Testing Library does not unmount between tests on
    // its own; without this the second test finds the first test's footer too.
    cleanup();
    enabled.value = false;
  });

  it('says an account is needed to generate where accounts exist — the gate is on', () => {
    enabled.value = true;
    const text = renderFooter();
    expect(text).toMatch(/generating needs an account/i);
    expect(text).not.toMatch(/no account required/i);
  });

  it('says no account is required where there is nothing to sign in to — the gate is off', () => {
    enabled.value = false;
    const text = renderFooter();
    expect(text).toMatch(/no account required/i);
    expect(text).not.toMatch(/needs an account/i);
  });
});
