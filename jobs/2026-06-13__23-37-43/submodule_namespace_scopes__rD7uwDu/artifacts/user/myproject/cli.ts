import { ArkErrors } from "arktype";
import { schemaModule } from "./src/schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printInvalid(reason: string): void {
  console.log(`INVALID: ${reason}`);
}

function printValid(payload: unknown): void {
  console.log("VALID");
  console.log(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Read stdin to completion, then process the single JSON object.
// ---------------------------------------------------------------------------

const chunks: Buffer[] = [];
process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
process.stdin.on("end", () => {
  const raw = Buffer.concat(chunks).toString("utf8").trim();

  // 1. Parse JSON
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    printInvalid("malformed JSON");
    process.exit(0);
  }

  // 2. Validate top-level structure: must be an object with `kind` and `payload`
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    Array.isArray(envelope)
  ) {
    printInvalid("input must be a JSON object");
    process.exit(0);
  }

  const { kind, payload } = envelope as Record<string, unknown>;

  if (payload === undefined) {
    printInvalid("missing field: payload");
    process.exit(0);
  }

  // 3. Select the validator based on `kind`
  type ApiKey = "CreateUserRequest" | "CreateOrgRequest";
  const kindMap: Record<string, ApiKey> = {
    createUser: "CreateUserRequest",
    createOrg: "CreateOrgRequest",
  };

  if (typeof kind !== "string" || !(kind in kindMap)) {
    printInvalid(
      `unknown kind "${kind}"; expected "createUser" or "createOrg"`
    );
    process.exit(0);
  }

  const validator = (schemaModule as unknown as { api: Record<ApiKey, (v: unknown) => unknown> })
    .api[kindMap[kind]];

  // 4. Validate payload
  const result = validator(payload);

  if (result instanceof ArkErrors) {
    printInvalid(result.summary);
    process.exit(0);
  }

  printValid(result);
  process.exit(0);
});
