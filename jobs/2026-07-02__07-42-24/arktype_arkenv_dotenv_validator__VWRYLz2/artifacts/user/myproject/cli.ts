import dotenv from "dotenv";
import { createEnv } from "arkenv";

try {
  // Load .env file at /home/user/myproject/.env
  dotenv.config({ path: "/home/user/myproject/.env" });

  // Validate the environment variables
  const env = createEnv({
    PORT: "1024 <= number.integer <= 65535",
    DATABASE_URL: "string.url",
    ALLOWED_ORIGINS: "string.url[] >= 1",
    LOG_LEVEL: "'debug' | 'info' | 'warn' | 'error'",
  });

  console.log("VALID");
  console.log(JSON.stringify(env));
  process.exit(0);
} catch (error: any) {
  const message = error.message ? error.message.replace(/\x1b\[[0-9;]*m/g, "") : String(error);
  const lines = message.split("\n").map((l: string) => l.trim()).filter(Boolean);
  let desc = "";
  if (lines[0]?.includes("Errors found while validating environment variables")) {
    desc = lines.slice(1).join(", ");
  } else {
    desc = lines.join(", ");
  }
  if (!desc) {
    desc = message;
  }
  console.log(`INVALID: ${desc}`);
  process.exit(0);
}
