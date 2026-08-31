import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAccount } from './components/layout/RequireAccount';
import { AppLayout } from './layouts/AppLayout';
import HomePage from './pages/Home';
import AboutPage from './pages/About';
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
const BlogIndexPage = lazy(() => import('./pages/Blog'));
const BlogPostPage = lazy(() => import('./pages/BlogPost'));
const AdminCommentsPage = lazy(() => import('./pages/AdminComments'));

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
        {/* Eager like Home and NotFound: it never touches the engine, so lazy-loading it
            would add a chunk request without saving anything. */}
        <Route path="about" element={<AboutPage />} />
        {/*
          Sign in before use — on the generator, which is where a system gets CREATED.

          The workspace is deliberately NOT guarded, and that is the whole of the difference.
          Guarding it too was tried and it breaks share links: /s regenerates from the query
          string and lands on /system/overview, so every link already sent would bounce its
          recipient to a sign-in page and show them nothing. Share links exist to show someone a
          result without an account — gating the viewer makes the feature pointless.

          Signed out, the only way to reach the workspace is a share link or a system already in
          this browser's session. Neither can be created without signing in first.
        */}
        <Route
          path="generator"
          element={
            <RequireAccount>
              <Suspense fallback={<RouteFallback />}>
                <GeneratorPage />
              </Suspense>
            </RequireAccount>
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
        <Route
          path="blog"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BlogIndexPage />
            </Suspense>
          }
        />
        <Route
          path="blog/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <BlogPostPage />
            </Suspense>
          }
        />
        <Route
          path="admin/comments"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AdminCommentsPage />
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
