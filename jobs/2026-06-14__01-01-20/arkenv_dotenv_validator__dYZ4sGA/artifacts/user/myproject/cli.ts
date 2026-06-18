import dotenv from "dotenv";
import { createEnv } from "arkenv";

// Load .env from the project root so arkenv can see the variables
dotenv.config({ path: new URL(".env", import.meta.url).pathname });

try {
  const env = createEnv(
    {
      PORT: "1024 <= number.integer <= 65535",
      DATABASE_URL: "string.url",
      ALLOWED_ORIGINS: "string.url[] > 0",
      LOG_LEVEL: '"debug" | "info" | "warn" | "error"',
    },
    {
      coerce: true,
    },
  );

  // On success: output VALID and the JSON representation
  console.log("VALID");
  console.log(JSON.stringify(env));
} catch (error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error);
  console.log(`INVALID: ${message}`);
}

process.exit(0);
