import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Create a Drizzle client backed by the D1 binding `env.DB`.
 *
 * Each request should call this with its own `env` so that the queries run
 * against the worker's request-scoped database binding.
 */
export const createDb = (env: { DB: D1Database }) =>
  drizzle(env.DB, { schema });

export { schema };