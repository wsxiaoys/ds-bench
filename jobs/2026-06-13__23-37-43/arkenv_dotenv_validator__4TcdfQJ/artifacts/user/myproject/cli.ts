import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import arkenv, { type } from "arkenv";
import { ArkEnvError } from "arkenv/core";

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the project root (same directory as this file)
const dotenvResult = config({ path: resolve(__dirname, ".env") });

// Merge dotenv parsed values into process.env (dotenv does this automatically,
// but we also want to pass them explicitly to createEnv for isolation)
const rawEnv: Record<string, string | undefined> = {
  ...process.env,
  ...(dotenvResult.parsed ?? {}),
};

try {
  // Define a custom validator for ALLOWED_ORIGINS:
  // arkenv with arrayFormat:"comma" will split the comma-separated string into
  // an array before validation, so we validate each element as a URL string.
  const env = arkenv(
    {
      PORT: "1024 <= number.integer <= 65535",
      DATABASE_URL: "string.url",
      ALLOWED_ORIGINS: type("string.url[]").atLeastLength(1),
      LOG_LEVEL: "'debug' | 'info' | 'warn' | 'error'",
    },
    {
      env: rawEnv,
      arrayFormat: "comma",
    }
  );

  console.log("VALID");
  console.log(
    JSON.stringify({
      PORT: env.PORT,
      DATABASE_URL: env.DATABASE_URL,
      ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
      LOG_LEVEL: env.LOG_LEVEL,
    })
  );
} catch (err) {
  if (err instanceof ArkEnvError) {
    console.log(`INVALID: ${err.message}`);
  } else {
    console.log(`INVALID: ${String(err)}`);
  }
}

process.exit(0);
