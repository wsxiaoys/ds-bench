import { defineConfig } from '@tanstack/start/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  tsr: {
    target: 'react',
    autoCodeSplitting: true,
    __enableAPIRoutesGeneration: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    preset: 'node-server',
  },
})