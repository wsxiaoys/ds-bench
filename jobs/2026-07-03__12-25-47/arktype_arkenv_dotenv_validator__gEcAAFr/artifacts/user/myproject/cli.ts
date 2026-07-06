import { config as loadDotenv } from "dotenv";
import arkenv from "arkenv";

// Load the .env file at the project root so that the values it defines
// become available to arkenv via process.env.
loadDotenv({ path: "/home/user/myproject/.env" });

// Declarative schema for the environment variables. The validation logic
// is driven by arkenv (using ArkType-style expressions) and its built-in
// coercion handles converting strings to the appropriate runtime types.
const schema = {
  PORT: "1024 <= number.integer <= 65535",
  DATABASE_URL: "string.url",
  ALLOWED_ORIGINS: "string.url[] >= 1",
  LOG_LEVEL: "'debug' | 'info' | 'warn' | 'error'",
};

try {
  const env = arkenv(schema, { arrayFormat: "comma" });
  console.log("VALID");
  console.log(JSON.stringify(env));
} catch (err) {
  const raw = err instanceof Error ? err.message : String(err);
  // Collapse the error message down to a single line so that stdout
  // contains exactly one non-empty line beginning with `INVALID:`.
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? raw;
  console.log(`INVALID: ${firstLine}`);
}
