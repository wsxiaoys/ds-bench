import * as fs from "fs";
import { types } from "./src/schema.js";
import { ArkErrors } from "arktype";

function main() {
  let input: string;
  try {
    input = fs.readFileSync(0, "utf-8");
  } catch (err: any) {
    console.log(`INVALID: Failed to read from stdin: ${err.message}`);
    process.exit(0);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(input);
  } catch (err: any) {
    console.log(`INVALID: Malformed JSON: ${err.message}`);
    process.exit(0);
  }

  if (!parsed || typeof parsed !== "object") {
    console.log("INVALID: Input must be a JSON object");
    process.exit(0);
  }

  if (!("kind" in parsed)) {
    console.log("INVALID: Missing 'kind' field");
    process.exit(0);
  }

  if (!("payload" in parsed)) {
    console.log("INVALID: Missing 'payload' field");
    process.exit(0);
  }

  const { kind, payload } = parsed;

  if (kind !== "createUser" && kind !== "createOrg") {
    console.log(`INVALID: Unknown kind '${kind}'`);
    process.exit(0);
  }

  if (!payload || typeof payload !== "object") {
    console.log("INVALID: 'payload' must be an object");
    process.exit(0);
  }

  let validator: any;
  if (kind === "createUser") {
    validator = types.api.CreateUserRequest;
  } else {
    validator = types.api.CreateOrgRequest;
  }

  const result = validator(payload);

  if (result instanceof ArkErrors) {
    console.log(`INVALID: ${result.summary}`);
  } else {
    console.log("VALID");
    console.log(JSON.stringify(result));
  }
}

main();
