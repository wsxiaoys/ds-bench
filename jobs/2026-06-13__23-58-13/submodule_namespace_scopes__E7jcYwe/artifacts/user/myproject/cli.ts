import { module } from "./src/schema.js";
import { ArkErrors } from "arktype";

async function main() {
  const buffers: Buffer[] = [];
  for await (const chunk of process.stdin) {
    buffers.push(chunk);
  }
  const input = Buffer.concat(buffers).toString("utf-8");

  let parsed: any;
  try {
    parsed = JSON.parse(input);
  } catch (e: any) {
    console.log(`INVALID: Malformed JSON (${e.message})`);
    process.exit(0);
  }

  if (!parsed || typeof parsed !== "object") {
    console.log("INVALID: Expected a JSON object");
    process.exit(0);
  }

  const kind = parsed.kind;
  const payload = parsed.payload;

  if (!kind || typeof kind !== "string") {
    console.log("INVALID: Missing or invalid 'kind' field");
    process.exit(0);
  }

  let schema;
  if (kind === "createUser") {
    schema = module.api.CreateUserRequest;
  } else if (kind === "createOrg") {
    schema = module.api.CreateOrgRequest;
  } else {
    console.log(`INVALID: Unknown kind '${kind}'`);
    process.exit(0);
  }

  const out = schema(payload);
  if (out instanceof ArkErrors) {
    console.log(`INVALID: ${out.summary.replace(/\n/g, ", ")}`);
  } else {
    console.log("VALID");
    console.log(JSON.stringify(out));
  }
}

main().catch(e => {
  console.log(`INVALID: Internal error - ${e.message}`);
  process.exit(0);
});
