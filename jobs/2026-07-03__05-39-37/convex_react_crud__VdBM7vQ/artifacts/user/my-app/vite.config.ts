import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

/**
 * Read the run id that isolates this app instance's data from other concurrent
 * test runs. It is exposed to the client as `import.meta.env.VITE_RUN_ID`.
 */
function getRunId(): string {
  try {
    return readFileSync("/logs/artifacts/run-id", "utf8").trim();
  } catch {
    return process.env.VITE_RUN_ID ?? "";
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  define: {
    "import.meta.env.VITE_RUN_ID": JSON.stringify(getRunId()),
    "import.meta.env.VITE_CONVEX_URL": JSON.stringify(
      process.env.CONVEX_URL ?? "",
    ),
  },
});