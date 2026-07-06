import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Read the run-id from the artifacts directory so we can isolate
// the counter state for each run/session.
let runId = ''
try {
  runId = readFileSync('/logs/artifacts/run-id', 'utf-8').trim()
} catch (err) {
  console.warn('Could not read /logs/artifacts/run-id:', err)
}

// Read the Convex deployment URL from the environment (CONVEX_URL or VITE_CONVEX_URL).
const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? ''

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load existing env variables for this mode (e.g. .env, .env.development).
  const env = loadEnv(mode, process.cwd(), '')

  // Inject the run-id from /logs/artifacts/run-id into the Vite env.
  env.VITE_RUN_ID = runId
  // Make sure VITE_CONVEX_URL is set in the loaded env so dev-time code
  // can read it via import.meta.env.
  if (!env.VITE_CONVEX_URL && convexUrl) {
    env.VITE_CONVEX_URL = convexUrl
  }

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    define: {
      'import.meta.env.VITE_RUN_ID': JSON.stringify(runId),
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(convexUrl),
    },
  }
})