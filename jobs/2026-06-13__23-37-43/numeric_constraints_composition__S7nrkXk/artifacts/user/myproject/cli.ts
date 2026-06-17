import { createInterface } from "readline";
import { validateDiscount } from "./src/validator.js";

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, terminal: false });

  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }

  const raw = lines.join("\n").trim();
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stdout.write("INVALID: input is not valid JSON\n");
    process.exit(0);
  }

  const result = validateDiscount(parsed);

  if (result.ok) {
    process.stdout.write("VALID\n");
    process.stdout.write(JSON.stringify(result.data) + "\n");
  } else {
    process.stdout.write("INVALID: " + result.summary + "\n");
  }

  process.exit(0);
}

main().catch((err) => {
  process.stdout.write("INVALID: " + String(err) + "\n");
  process.exit(0);
});
