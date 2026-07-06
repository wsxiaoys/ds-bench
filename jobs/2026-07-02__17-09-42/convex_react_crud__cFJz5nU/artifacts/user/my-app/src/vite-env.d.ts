/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string
  readonly VITE_RUN_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
