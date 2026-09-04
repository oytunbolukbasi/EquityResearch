import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'
import { DensityProvider } from './lib/density'
import { SessionProvider } from './lib/session'
import { ToastProvider } from './lib/toast'
import { ConfirmProvider } from './lib/confirm'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DensityProvider>
        <SessionProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </SessionProvider>
      </DensityProvider>
    </ThemeProvider>
  </StrictMode>,
)
