import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Read the session secret from disk at config load time and inline it into
// the worker bundle via Vite's `define` so the worker (workerd) can read it
// at runtime without needing filesystem access.
const SESSION_SECRET = readFileSync(
  "/home/user/session_secret.txt",
  "utf8",
).trim();

export default defineConfig({
  define: {
    __SESSION_SECRET__: JSON.stringify(SESSION_SECRET),
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
});
