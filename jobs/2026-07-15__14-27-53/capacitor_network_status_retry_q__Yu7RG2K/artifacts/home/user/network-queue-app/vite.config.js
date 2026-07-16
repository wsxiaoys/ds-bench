import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: false,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 3000,
  },
});
