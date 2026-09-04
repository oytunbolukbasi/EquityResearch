import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'
import { DensityProvider } from './lib/density'
import { SessionProvider } from './lib/session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DensityProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </DensityProvider>
    </ThemeProvider>
  </StrictMode>,
)
