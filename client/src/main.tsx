import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'
import { DensityProvider } from './lib/density'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DensityProvider>
        <App />
      </DensityProvider>
    </ThemeProvider>
  </StrictMode>,
)
