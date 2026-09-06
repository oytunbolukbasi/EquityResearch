import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Single-service layout: Vite app lives in client/, builds to dist/public,
// which the Express server (server/) serves in production.
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'client'),
  plugins: [react(), tailwindcss()],
  resolve: {
    // Force a single React instance — react-grid-layout (CJS) otherwise gets
    // its own copy during pre-bundling, triggering "Invalid hook call".
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(import.meta.dirname, 'client/src'),
      // Facts both the client and the server must agree on — see shared/.
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  optimizeDeps: {
    include: ['react-grid-layout', 'react-draggable', 'react-resizable'],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // shared/ sits outside the Vite root, so dev has to be told it may read it.
    fs: { allow: [import.meta.dirname] },
    // During dev, proxy API calls to the Express server (added in step 3).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
