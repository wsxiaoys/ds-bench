import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    server: {
      port: 3000,
      host: true,
      strictPort: true,
    },
    preview: {
      port: 3000,
      host: true,
      strictPort: true,
    },
  };
});
