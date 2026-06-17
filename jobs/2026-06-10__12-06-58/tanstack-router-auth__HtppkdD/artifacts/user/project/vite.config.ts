import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  server: {
    port: 6382,
  },
})
