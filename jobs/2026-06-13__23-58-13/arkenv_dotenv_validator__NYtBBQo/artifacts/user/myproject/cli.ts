import arkenv from "arkenv";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve("/home/user/myproject/.env") });

try {
  const env = arkenv({
    PORT: "number.integer >= 1024 <= 65535",
    DATABASE_URL: "string.url",
    ALLOWED_ORIGINS: "string.url[] >= 1",
    LOG_LEVEL: "'debug' | 'info' | 'warn' | 'error'"
  });
  console.log("VALID");
  console.log(JSON.stringify(env));
  process.exit(0);
} catch (e: any) {
  const msg = e?.message ? e.message.replace(/\n/g, " ").replace(/\s+/g, " ").trim() : String(e);
  console.log("INVALID: " + msg);
  process.exit(0);
}
