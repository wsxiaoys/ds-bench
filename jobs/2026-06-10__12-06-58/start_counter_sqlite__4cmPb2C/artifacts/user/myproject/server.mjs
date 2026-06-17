/**
 * Node.js HTTP server entry point for production.
 * Wraps the TanStack Start server bundle with srvx to create
 * a standalone HTTP server bound to 0.0.0.0:PORT.
 */
import { serve } from 'srvx/node'

const port = Number(process.env.PORT) || 47329

// Dynamic import so this file works before the build as well
const { default: app } = await import('./dist/server/server.js')

const server = serve({
  fetch: (req) => app.fetch(req),
  port,
  hostname: '0.0.0.0',
})

await server.ready()
console.log(`Server listening on http://0.0.0.0:${port}`)
