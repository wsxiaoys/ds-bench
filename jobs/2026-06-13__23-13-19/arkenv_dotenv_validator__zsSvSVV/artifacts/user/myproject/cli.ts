import dotenv from "dotenv";
import { createEnv } from "arkenv";

// Load environment variables from the .env file and merge with process.env
dotenv.config({ path: "/home/user/myproject/.env" });

// Define the environment schema with validation and coercion rules
const schema = {
  PORT: "1024 <= number.integer <= 65535",
  DATABASE_URL: "string.url",
  ALLOWED_ORIGINS: "string.url[] >= 1",
  LOG_LEVEL: "'debug' | 'info' | 'warn' | 'error'",
};

try {
  // Validate the merged environment variables
  const validated = createEnv(schema);
  console.log("VALID");
  console.log(JSON.stringify(validated));
} catch (e: any) {
  // Extract and clean up the error message into a single line starting with INVALID:
  const lines = e.message.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const description = lines.join("; ");
  console.log(`INVALID: ${description}`);
}

// Always exit with 0 as required
process.exit(0);
