import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Drizzle ORM client bound to the Cloudflare D1 database.
 * Access via `env.DB` (declared in `wrangler.jsonc` under `d1_databases`).
 */
export const db = drizzle(env.DB, { schema });

export { schema };
