import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    // Local D1 development endpoint; wrangler dev will proxy this
    // For migration generation only - actual migrations apply via wrangler
    url: "http://127.0.0.1:8787",
  },
});
