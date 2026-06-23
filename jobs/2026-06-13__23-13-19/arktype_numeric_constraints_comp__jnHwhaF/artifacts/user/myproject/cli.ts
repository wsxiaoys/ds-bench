import * as fs from "fs";
import { validateDiscount } from "./src/validator.js";

try {
  const inputStr = fs.readFileSync(0, "utf-8").trim();
  if (!inputStr) {
    console.log("INVALID: Empty input");
    process.exit(0);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(inputStr);
  } catch (err: any) {
    console.log(`INVALID: Invalid JSON: ${err.message}`);
    process.exit(0);
  }

  const result = validateDiscount(payload);
  if (result.success) {
    console.log("VALID");
    console.log(JSON.stringify(result.data));
  } else {
    console.log(`INVALID: ${result.error}`);
  }
} catch (err: any) {
  console.log(`INVALID: ${err.message}`);
}
process.exit(0);
