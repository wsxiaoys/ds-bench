import { type } from "arktype";
import { Pipeline } from "./src/pipeline.js";

/**
 * Read the entire raw CSV from stdin verbatim. We deliberately do not
 * trim, normalize, or otherwise massage the bytes before they reach the
 * ArkType pipeline; the pipeline itself is responsible for accepting or
 * rejecting the exact bytes it was given.
 */
async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}

function emitInvalid(message: string): void {
	process.stdout.write(`INVALID: ${message}\n`);
}

function emitValid(payload: unknown): void {
	process.stdout.write("VALID\n");
	process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function main(): Promise<void> {
	const raw = await readStdin();

	let result: unknown;
	try {
		// The pipeline may either return the validated/morphed data or an
		// `ArkErrors` instance. A morph that throws (parseCsv) is also a
		// possible failure path, and is caught here.
		result = Pipeline(raw);
	} catch (e) {
		emitInvalid(e instanceof Error ? e.message : String(e));
		return;
	}

	if (result instanceof type.errors) {
		emitInvalid(result.summary);
		return;
	}

	// `result` is a strongly-typed array of user records whose `signupAt`
	// field is a real `Date` instance. `JSON.stringify` on a `Date` uses
	// `Date.prototype.toJSON`, which produces an ISO-8601 string, so no
	// manual serialization is required.
	emitValid(result);
}

// Always exit with code 0 so downstream tooling can distinguish success
// from failure via stdout alone.
main().then(
	() => {
		process.exit(0);
	},
	(e: unknown) => {
		emitInvalid(e instanceof Error ? e.message : String(e));
		process.exit(0);
	}
);
