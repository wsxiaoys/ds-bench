import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 6382,
    host: true,
  },
  plugins: [react()],
});
