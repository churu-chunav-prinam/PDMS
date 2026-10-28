import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    // Never inline assets as data: URIs: the backend CSP (default-src 'self') would block them.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    port: 5174,
    strictPort: true,
    // changeOrigin false: the backend sees Origin http://localhost:5174 (= APP_ORIGIN in dev).
    proxy: { '/api': { target: 'http://localhost:3200', changeOrigin: false } },
  },
});
