import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      REDACTEDCodeSplitting: true,
    }),
    react(),
  ],
  server: {
    port: 8765,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 8765,
    strictPort: true,
  },
});