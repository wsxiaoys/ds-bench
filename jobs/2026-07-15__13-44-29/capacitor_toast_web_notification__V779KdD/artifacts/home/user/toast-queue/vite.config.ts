import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    strictPort: true,
  },
});
