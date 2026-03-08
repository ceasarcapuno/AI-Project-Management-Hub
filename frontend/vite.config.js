import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ─── Vite Configuration ────────────────────────────────────────────────────
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the Express backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
