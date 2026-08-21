import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { GeneratedSystemProvider } from './context/GeneratedSystemContext'
import { SystemStoreProvider } from './context/SystemStoreContext'

// AuthProvider must sit above SystemStoreProvider: the store provider reads the session to
// decide whether saves go to the account or to this browser.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <GeneratedSystemProvider>
            <SystemStoreProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </SystemStoreProvider>
          </GeneratedSystemProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
