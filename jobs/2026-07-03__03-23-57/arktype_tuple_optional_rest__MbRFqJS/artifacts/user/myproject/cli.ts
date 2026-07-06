import * as readline from "node:readline";
import { emit } from "./src/emit.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const args = parsed.args;
    if (!Array.isArray(args)) {
      console.log("ERR Input args must be an array");
      process.exit(0);
    }

    try {
      const result = (emit as any)(...args);
      console.log(`OK ${JSON.stringify(result)}`);
    } catch (err: any) {
      console.log(`ERR ${err.message || String(err)}`);
    }
  } catch (err: any) {
    console.log(`ERR Invalid JSON input: ${err.message || String(err)}`);
  }
  process.exit(0);
});
