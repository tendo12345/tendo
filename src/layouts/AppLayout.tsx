import { Outlet } from 'react-router-dom';
import { NavBar } from '../components/layout/NavBar';
import { Footer } from '../components/layout/Footer';
import { ToastViewport } from '../components/ui/ToastViewport';

export function AppLayout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <NavBar />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <ToastViewport />
    </>
  );
}
