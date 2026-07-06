import * as fs from "node:fs";
import { pipeline } from "./src/pipeline.js";
import { ArkErrors } from "arktype";

try {
  // Read the entire raw CSV from stdin verbatim
  const input = fs.readFileSync(0, "utf-8");
  const result = pipeline(input);

  if (result instanceof ArkErrors) {
    // Print error messages via INVALID: <msg> on a single line
    // Replacing any newlines in the summary to keep it on a single line
    const cleanSummary = result.summary.replace(/\r?\n/g, " | ");
    console.log(`INVALID: ${cleanSummary}`);
  } else {
    // On success, print exactly VALID on the first line and the JSON array of serialized records on the second line
    console.log("VALID");
    console.log(JSON.stringify(result));
  }
} catch (err: any) {
  console.log(`INVALID: ${err.message || String(err)}`);
}
// Always exit with code 0 so downstream tooling can distinguish success from failure via stdout alone.
process.exit(0);
