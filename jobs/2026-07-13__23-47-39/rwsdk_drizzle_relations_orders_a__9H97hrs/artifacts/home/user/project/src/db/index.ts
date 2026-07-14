import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

// Drizzle client wired to the Cloudflare D1 `DB` binding.
// `env` is imported from `cloudflare:workers` so the binding is resolved
// per-request inside the worker runtime.
export const db = drizzle(env.DB, { schema });

export { schema };