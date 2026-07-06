import { config as loadDotenv } from "dotenv";
import arkenv from "arkenv";

// Load the .env file at the project root into process.env. dotenv does not
// override existing process.env entries, so values already in the environment
// take precedence over the .env file values.
loadDotenv({ path: "/home/user/myproject/.env" });

// Declarative env schema passed to arkenv. arkenv combines this shape with
// its built-in coercion (string -> number, comma-split arrays, etc.) so we do
// not need to call arktype directly to construct the env schema.
const schema = {
  PORT: "1024 <= number.integer <= 65535",
  DATABASE_URL: "string.url",
  ALLOWED_ORIGINS: "string.url[] > 0",
  LOG_LEVEL: "'debug' | 'info' | 'warn' | 'error'",
} as const;

try {
  const env = arkenv(schema);
  process.stdout.write("VALID\n");
  process.stdout.write(`${JSON.stringify(env)}\n`);
} catch (error) {
  const raw = error instanceof Error ? error.message : String(error);
  // Collapse arkenv's multi-line, optionally-coloured error into a single
  // line so stdout contains exactly one non-empty line on failure.
  const singleLine = raw
    .replace(/\x1B\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");
  process.stdout.write(`INVALID: ${singleLine}\n`);
}

process.exit(0);
