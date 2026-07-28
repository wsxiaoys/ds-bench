// Production entry point. Wraps the TanStack Start fetch handler produced by
// `vite build` (dist/server/server.js) with a Node.js HTTP server via srvx,
// listening on the port specified by the PORT environment variable.
import { serve } from 'srvx/node'
import server from './dist/server/server.js'

serve({
  fetch: server.fetch,
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
})
