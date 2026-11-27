import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Cible du proxy /api. Dans Docker : http://backend:8000 (nom du service compose).
// En local sans Docker : API_PROXY_TARGET=http://localhost:8000 npm run dev
const apiTarget = process.env.API_PROXY_TARGET || 'http://backend:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    // Si le code est monté en volume sous Windows/macOS dans Docker : watch: { usePolling: true },
  },
})
