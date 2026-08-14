import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export const getDb = () => {
  // env.DB comes from the Cloudflare Worker environment (using cloudflare:workers)
  return drizzle(env.DB, { schema });
};
