import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
import { log } from 'srvx/log'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const serverEntry = path.join(root, 'dist/server/server.js')
const clientDir = path.join(root, 'dist/client')

const mod = await import(new URL(`file://${serverEntry}`).href)
const fetchHandler = mod.default?.fetch ?? mod.fetch

if (!fetchHandler) {
  throw new Error(
    `No fetch handler exported from ${serverEntry}. Did you run "npm run build" first?`,
  )
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000

const server = serve({
  port,
  hostname: process.env.HOST,
  fetch: fetchHandler,
  middleware: [log(), serveStatic({ dir: clientDir })],
})

await server.ready()
