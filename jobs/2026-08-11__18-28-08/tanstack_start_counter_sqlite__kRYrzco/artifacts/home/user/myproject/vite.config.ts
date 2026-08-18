import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 47329

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port,
    host: '0.0.0.0',
  },
  preview: {
    port,
    host: '0.0.0.0',
  },
  plugins: [tanstackStart(), nitro(), viteReact()],
})

export default config
