import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, '/api')
      },
      '/api/reports': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/predict': {
        target: 'http://127.0.0.1:8000', // FastAPI backend with loaded models
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/predict/, '/predict')
      },
      '/api/federated': {
        target: 'http://127.0.0.1:8004', // proxy to Federated Learning service
        changeOrigin: true
      }
    }
  }
})
