import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Proxy all /api/* requests to the backend on port 8080.
    // This eliminates CORS entirely in local development because
    // both the frontend and API appear to be on the same origin (5173).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Vite Proxy Error]', err.message);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[Vite Proxy →]', req.method, req.url);
          });
        }
      }
    }
  }
});
