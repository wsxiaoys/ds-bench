import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 4173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});