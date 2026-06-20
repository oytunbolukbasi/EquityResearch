import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// react-grid-layout base styles first, so our overrides in index.css win.
import 'react-grid-layout/css/styles.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
