import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export { schema };

let _env: Env | null = null;

export function setEnv(env: Env) {
  _env = env;
}

export function getDb() {
  if (!_env) {
    throw new Error(
      "Database environment not initialized. setEnv must be called at the start of the request.",
    );
  }
  return drizzle(_env.DB, { schema });
}