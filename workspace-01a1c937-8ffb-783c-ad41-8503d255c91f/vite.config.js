import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true }
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true }
    }
  }
});
