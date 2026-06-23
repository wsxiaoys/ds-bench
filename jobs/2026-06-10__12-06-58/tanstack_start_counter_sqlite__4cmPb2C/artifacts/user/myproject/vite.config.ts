import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

const port = Number(process.env.PORT) || 47329

export default defineConfig({
  server: {
    port,
    host: '0.0.0.0',
  },
  preview: {
    port,
    host: '0.0.0.0',
  },
  plugins: [
    tanstackStart(),
    viteReact(),
  ],
})
