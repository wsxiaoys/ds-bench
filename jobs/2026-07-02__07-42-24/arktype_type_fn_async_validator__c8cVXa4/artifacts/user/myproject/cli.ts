import * as fs from "fs";
import { fetchWithTimeout } from "./src/validator.js";

async function main() {
  try {
    const input = fs.readFileSync(0, "utf-8").trim();
    if (!input) {
      console.log("ERR Stdin is empty");
      process.exit(0);
    }

    let parsed;
    try {
      parsed = JSON.parse(input);
    } catch (e: any) {
      console.log(`ERR Invalid JSON input: ${e.message}`);
      process.exit(0);
    }

    if (!parsed || typeof parsed !== "object" || !("params" in parsed)) {
      console.log("ERR Input must be a JSON object containing a 'params' key");
      process.exit(0);
    }

    const params = parsed.params;

    let resultPromise;
    try {
      resultPromise = fetchWithTimeout(params);
    } catch (e: any) {
      console.log(`ERR ${e.message}`);
      process.exit(0);
    }

    try {
      const result = await resultPromise;
      console.log(`OK ${JSON.stringify(result)}`);
    } catch (e: any) {
      console.log(`ERR ${e.message}`);
    }
  } catch (e: any) {
    console.log(`ERR Unexpected error: ${e.message}`);
  }
  process.exit(0);
}

main();
