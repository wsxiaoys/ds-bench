import * as fs from "node:fs";
import { validateDirectoryTree } from "./src/validator.js";

function main() {
  try {
    const inputStr = fs.readFileSync(0, "utf-8").trim();
    if (!inputStr) {
      console.log("INVALID: Empty input");
      process.exit(0);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(inputStr);
    } catch (err: any) {
      console.log(`INVALID: Invalid JSON: ${err.message}`);
      process.exit(0);
    }

    const validated = validateDirectoryTree(parsed);
    console.log("VALID");
    console.log(JSON.stringify(validated));
  } catch (err: any) {
    console.log(`INVALID: ${err.message || err}`);
  }
  process.exit(0);
}

main();
