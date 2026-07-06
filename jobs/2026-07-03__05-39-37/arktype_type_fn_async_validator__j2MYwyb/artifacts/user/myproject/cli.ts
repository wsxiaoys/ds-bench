import { fetchWithTimeout } from "./src/validator.js";

/**
 * Read the entire stdin stream as a UTF-8 string.
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

/**
 * Extract a non-empty, human-readable description from any thrown value.
 *
 * ArkType validation failures throw a `TraversalError` (an `Error` subclass
 * whose `message` is the `ArkErrors.summary`). We fall back gracefully for
 * any other thrown shape.
 */
function describeError(e: unknown): string {
  if (e !== null && typeof e === "object") {
    const summary = (e as { summary?: unknown }).summary;
    if (typeof summary === "string" && summary.length > 0) {
      return summary;
    }
  }
  if (e instanceof Error && e.message) {
    return e.message;
  }
  const s = String(e);
  return s || "validation failed";
}

async function main(): Promise<void> {
  let input: string;
  try {
    input = await readStdin();
  } catch (e) {
    process.stdout.write(`ERR ${describeError(e)}\n`);
    return;
  }

  let result: unknown;
  try {
    let doc: unknown;
    try {
      doc = JSON.parse(input);
    } catch (e) {
      throw new Error(`invalid JSON input: ${describeError(e)}`);
    }

    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error("input must be a JSON object with a \"params\" field");
    }

    const params = (doc as { params?: unknown }).params;
    if (params === undefined) {
      throw new Error("input must be a JSON object with a \"params\" field");
    }

    // `await` captures both synchronous throws (parameter validation at the
    // type.fn boundary) and rejected promises (resolved-value validation).
    result = await fetchWithTimeout(params);
  } catch (e) {
    process.stdout.write(`ERR ${describeError(e)}\n`);
    return;
  }

  process.stdout.write(`OK ${JSON.stringify(result)}\n`);
}

// Always exit with code 0 for both success and validation-failure paths.
main().then(
  () => process.exit(0),
  (e) => {
    // Should not normally happen, but guard against unexpected rejections.
    process.stdout.write(`ERR ${describeError(e)}\n`);
    process.exit(0);
  }
);