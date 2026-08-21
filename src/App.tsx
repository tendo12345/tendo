import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import HomePage from './pages/Home';
import NotFoundPage from './pages/NotFound';

/*
  Everything that touches the engine is loaded on demand.

  The engine statically imports the ported dataset, so any route that reaches it pulls
  ~100 kB gzipped into whatever chunk it lands in. Eagerly imported, that meant a visitor
  who only ever read the landing page still downloaded all 161 product types and 84 styles.

  Home stays eager — it is the entry point and renders from the precomputed sample, which is
  a few kB. The rest split out, so the dataset arrives when someone actually generates
  something rather than before they have decided to.
*/
const GeneratorPage = lazy(() => import('./pages/Generator'));
const WorkspacePage = lazy(() => import('./pages/Workspace'));
const SharePage = lazy(() => import('./pages/Share'));
const AccountPage = lazy(() => import('./pages/Account'));

/**
 * Deliberately minimal.
 *
 * These chunks are local and small, so a spinner would usually flash and vanish — worse than
 * nothing. An empty region of the right shape avoids the layout jump without pretending
 * something slow is happening.
 */
function RouteFallback() {
  return <div style={{ minHeight: '60vh' }} aria-busy="true" />;
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route
          path="generator"
          element={
            <Suspense fallback={<RouteFallback />}>
              <GeneratorPage />
            </Suspense>
          }
        />
        {/* Share links carry the input in the query string and regenerate on arrival. */}
        <Route
          path="s"
          element={
            <Suspense fallback={<RouteFallback />}>
              <SharePage />
            </Suspense>
          }
        />
        <Route
          path="account"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AccountPage />
            </Suspense>
          }
        />
        {/* The workspace is one section at a time, addressed by URL. */}
        <Route path="system" element={<Navigate to="/system/overview" replace />} />
        <Route
          path="system/:section"
          element={
            <Suspense fallback={<RouteFallback />}>
              <WorkspacePage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
