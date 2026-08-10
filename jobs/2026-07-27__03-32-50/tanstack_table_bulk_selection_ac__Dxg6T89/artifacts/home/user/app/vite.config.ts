import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT || 34517}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
