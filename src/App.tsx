import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import HomePage from './pages/Home';
import GeneratorPage from './pages/Generator';
import WorkspacePage from './pages/Workspace';
import SharePage from './pages/Share';
import AccountPage from './pages/Account';
import NotFoundPage from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="generator" element={<GeneratorPage />} />
        {/* Share links carry the input in the query string and regenerate on arrival. */}
        <Route path="s" element={<SharePage />} />
        <Route path="account" element={<AccountPage />} />
        {/* The workspace is one section at a time, addressed by URL. */}
        <Route path="system" element={<Navigate to="/system/overview" replace />} />
        <Route path="system/:section" element={<WorkspacePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
