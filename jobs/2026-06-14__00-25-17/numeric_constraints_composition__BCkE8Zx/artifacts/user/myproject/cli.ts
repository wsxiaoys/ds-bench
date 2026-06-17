import { readFileSync } from "node:fs";
import { validateDiscount } from "./src/validator.js";

const input = readFileSync(0, "utf-8").trim();

try {
  const parsed = JSON.parse(input);
  const result = validateDiscount(parsed);
  if (result.valid) {
    console.log("VALID");
    console.log(JSON.stringify(result.data));
  } else {
    console.log(`INVALID: ${result.error}`);
  }
} catch (e: any) {
  console.log(`INVALID: ${e.message}`);
}

process.exit(0);