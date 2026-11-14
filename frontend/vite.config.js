import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiTarget = (env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
