import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_RUN_ID': JSON.stringify(process.env.ZEALT_RUN_ID || 'default-run-id'),
    'import.meta.env.VITE_CONVEX_URL': JSON.stringify(process.env.CONVEX_URL || '')
  }
})
