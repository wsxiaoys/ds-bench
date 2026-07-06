import { config } from "dotenv";
import arkenv from "arkenv";

// Load the .env file at the project root and merge its values into process.env.
// dotenv only sets keys that are not already present in process.env.
config({ path: "/home/user/myproject/.env" });

try {
  const env = arkenv({
    PORT: "1024 <= number.integer <= 65535",
    DATABASE_URL: "string.url",
    ALLOWED_ORIGINS: "string.url[] >= 1",
    LOG_LEVEL: '"debug" | "info" | "warn" | "error"',
  });

  console.log("VALID");
  console.log(JSON.stringify(env));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // Strip ANSI escape codes and collapse all whitespace into a single line.
  const cleaned = message
    .replace(/\x1B\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim();
  console.log(`INVALID: ${cleaned}`);
}

process.exit(0);