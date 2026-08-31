import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { accountsEnabled } from '../../lib/supabase';

/**
 * Sign in before use.
 *
 * Wraps the routes that need an account: a signed-out visitor is sent to `/account` rather than
 * reaching the generator or a generated system at all. Gating the submit button alone let
 * someone fill the entire form before being told, which is the worse version of the same rule.
 *
 * Three conditions decide this, and two of them are easy to get wrong:
 *
 * `accountsEnabled()` — false when the deployment has no Supabase project, which is a supported
 * state this repo keeps working on purpose. Without this check the generator becomes
 * permanently unreachable there: nothing to sign in to, and no way past the redirect. The gate
 * only exists where there is an account to reach.
 *
 * `status === 'loading'` — renders nothing rather than redirecting. The session resolves
 * asynchronously, so treating "not yet known" as "signed out" bounces signed-in visitors to
 * `/account` on every cold load, and they arrive at a page that immediately redirects them back.
 * A blank frame for one tick is the correct behaviour while the answer is genuinely unknown.
 *
 * `state.from` — carries where they were going, so signing in returns them there instead of
 * stranding them on the account page. `replace` keeps the guarded URL out of history: without
 * it, Back from `/account` lands on the guarded route and bounces forward again, trapping them.
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  // No account to require. This is the whole reason Basis still runs with no backend.
  if (!accountsEnabled()) return <>{children}</>;

  if (status === 'loading') return null;

  if (status === 'signed-out') {
    return <Navigate to="/account" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
