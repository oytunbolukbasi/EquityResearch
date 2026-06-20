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
    alias: {
      '@': path.resolve(import.meta.dirname, 'client/src'),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // During dev, proxy API calls to the Express server (added in step 3).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
