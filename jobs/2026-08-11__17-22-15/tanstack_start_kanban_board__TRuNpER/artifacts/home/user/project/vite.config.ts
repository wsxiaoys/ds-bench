import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 34517,
  },
  preview: {
    port: 34517,
    strictPort: true,
  },
  plugins: [
    tanstackStart(),
    viteReact(),
  ],
})
