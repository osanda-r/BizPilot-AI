import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.BACKEND_URL || 'http://127.0.0.1:8000'
  const proxy = {
    '/api': { target: backend, changeOrigin: true },
    '/health': { target: backend, changeOrigin: true },
  }
  const hostConfig = {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    proxy,
  }
  return {
    plugins: [react()],
    server: { ...hostConfig, port: 5173, strictPort: true },
    preview: { ...hostConfig, port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      clearMocks: true,
    },
  }
})
