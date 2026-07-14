import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";

import * as schema from "./schema";

/**
 * Drizzle database instance bound to the D1 `DB` binding declared in
 * `wrangler.jsonc`. Created once at module load time. Every API handler
 * imports this same instance.
 */
export const db = drizzle(env.DB, { schema });

export type Database = typeof db;