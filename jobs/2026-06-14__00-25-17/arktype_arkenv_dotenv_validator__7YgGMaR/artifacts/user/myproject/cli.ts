import dotenv from "dotenv";
import arkenv from "arkenv";

// Load .env file so values become available to arkenv via process.env
dotenv.config({ path: "/home/user/myproject/.env" });

try {
  const env = arkenv(
    {
      PORT: "1024 <= number.integer <= 65535",
      DATABASE_URL: "string.url",
      ALLOWED_ORIGINS: "string.url[] >= 1",
      LOG_LEVEL: "'debug' | 'info' | 'warn' | 'error'",
    },
    { coerce: true, arrayFormat: "comma" },
  );

  console.log("VALID");
  console.log(
    JSON.stringify({
      PORT: env.PORT,
      DATABASE_URL: env.DATABASE_URL,
      ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
      LOG_LEVEL: env.LOG_LEVEL,
    }),
  );
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // Strip ANSI escape codes and collapse to a single line
  const clean = message.replace(/\x1B\[[0-9;]*m/g, "");
  const singleLine = clean.replace(/\n/g, "; ").replace(/\s+/g, " ").trim();
  console.log(`INVALID: ${singleLine}`);
}

process.exit(0);