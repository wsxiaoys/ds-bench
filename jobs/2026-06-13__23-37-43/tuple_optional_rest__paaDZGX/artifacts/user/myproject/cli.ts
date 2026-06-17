import { emit } from "./src/emit.ts";

// Read a single JSON line from stdin: { "args": [...] }
// Then call emit(...args) and print the result.

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  raw += chunk;
}

const input = JSON.parse(raw.trim()) as { args: unknown[] };

try {
  const result = emit(...(input.args as Parameters<typeof emit>));
  process.stdout.write(`OK ${JSON.stringify(result)}\n`);
} catch (err: unknown) {
  const message =
    err instanceof Error ? err.message : String(err);
  process.stdout.write(`ERR ${message}\n`);
}

process.exit(0);
