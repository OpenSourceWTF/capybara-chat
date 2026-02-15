/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In Docker, use service name. Otherwise use localhost.
// DOCKER env var is set in compose.dev.yaml
const proxyTarget = process.env.DOCKER === 'true'
  ? 'http://server:2279'
  : 'http://localhost:2279';

export default defineConfig({
  define: {
    // Shim process.env for browser compatibility with shared packages
    'process.env': JSON.stringify({}),
  },
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 2281, // CAPY + 2
    host: '0.0.0.0', // Allow access from host when in Docker
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: proxyTarget,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
  },
});
