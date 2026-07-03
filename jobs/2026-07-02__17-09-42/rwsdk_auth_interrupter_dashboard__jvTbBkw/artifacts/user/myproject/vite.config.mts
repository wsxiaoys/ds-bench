import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * Load the session signing secret from disk at Vite startup time and inject
 * it as a build-time constant. The runtime worker code never touches the
 * filesystem — it only sees the literal string here.
 *
 * `workerd` (the Cloudflare Workers runtime that Vite uses in dev mode)
 * does not implement `node:fs`, so reading the file from the worker would
 * fail. Doing it from Node during Vite config evaluation side-steps that
 * entirely.
 */
const SESSION_SECRET_PATH = "/home/user/session_secret.txt";
const sessionSecret = readFileSync(SESSION_SECRET_PATH, "utf8").trim();

export default defineConfig({
  define: {
    __SESSION_SECRET__: JSON.stringify(sessionSecret),
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
});