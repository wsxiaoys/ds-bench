import { validateDirectoryTree } from "./src/validator.ts";

// Read JSON payload from stdin
let input = "";
process.stdin.setEncoding("utf-8");

process.stdin.on("data", (chunk: string) => {
  input += chunk;
});

process.stdin.on("end", () => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    console.log("INVALID: input is not valid JSON");
    process.exit(0);
  }

  try {
    const result = validateDirectoryTree(parsed);
    console.log("VALID");
    console.log(JSON.stringify(result));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`INVALID: ${message}`);
  }

  process.exit(0);
});
