// Must run before react-grid-layout (react-draggable reads process.env).
import './lib/process-shim'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// react-grid-layout base styles first, so our overrides in index.css win.
import 'react-grid-layout/css/styles.css'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
