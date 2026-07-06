import { defineConfig, type PluginOption } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Port resolution: honor PORT if set, fall back to 47329 per the task
// specification. Bound to 0.0.0.0 so the server is reachable externally.
const DEFAULT_PORT = 47329
const port = Number.parseInt(process.env.PORT ?? '', 10) || DEFAULT_PORT

/**
 * Ensures the SQLite database is initialized and the seed row is in place
 * before the HTTP listener starts accepting connections. Runs both for the
 * Vite dev server and the `vite preview` server.
 */
function initDbOnBoot(): PluginOption {
  return {
    name: 'init-db-on-boot',
    async configureServer() {
      const { initDb } = await import('./src/server/db')
      initDb()
    },
    async configurePreviewServer() {
      const { initDb } = await import('./src/server/db')
      initDb()
    },
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: '0.0.0.0',
    port,
  },
  preview: {
    host: '0.0.0.0',
    port,
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    initDbOnBoot(),
  ],
})
