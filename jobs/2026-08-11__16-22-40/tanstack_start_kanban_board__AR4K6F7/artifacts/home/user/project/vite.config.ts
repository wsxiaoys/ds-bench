import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 34517,
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart(),
    viteReact(),
  ],
})
