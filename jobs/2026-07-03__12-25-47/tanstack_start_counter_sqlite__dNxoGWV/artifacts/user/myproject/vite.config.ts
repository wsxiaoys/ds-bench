import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const DEFAULT_PORT = 47329
const PORT = Number(process.env.PORT ?? DEFAULT_PORT)

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: '0.0.0.0',
    port: PORT,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: PORT,
    strictPort: false,
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
