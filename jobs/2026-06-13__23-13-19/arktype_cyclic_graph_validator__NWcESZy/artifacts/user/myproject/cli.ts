import * as fs from "node:fs";
import { validateGraph } from "./src/validator.js";

function main() {
  try {
    const inputStr = fs.readFileSync(0, "utf-8").trim();
    if (!inputStr) {
      console.log("INVALID: empty input");
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(inputStr);
    } catch (e: any) {
      console.log(`INVALID: invalid JSON: ${e.message}`);
      return;
    }

    if (typeof payload !== "object" || payload === null) {
      console.log("INVALID: input must be a JSON object");
      return;
    }

    if (!("graph" in payload)) {
      console.log("INVALID: missing 'graph' key in input");
      return;
    }

    try {
      const validated = validateGraph((payload as any).graph);
      console.log("VALID");
      console.log(JSON.stringify(validated));
    } catch (e: any) {
      console.log(`INVALID: ${e.message}`);
    }
  } catch (e: any) {
    console.log(`INVALID: unexpected error: ${e.message}`);
  }
}

main();
