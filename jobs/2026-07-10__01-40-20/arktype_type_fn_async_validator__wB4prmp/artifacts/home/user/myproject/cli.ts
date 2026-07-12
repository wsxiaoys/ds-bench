import { fetchWithTimeout } from "./src/validator.js";

/**
 * Reads the entire contents of stdin as a UTF-8 string.
 */
function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk: string) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		// If stdin is a TTY with no input, the "end" event still fires once
		// the stream is closed (e.g. on EOF / Ctrl-D).
	});
}

/**
 * Extracts a non-empty, single-line human-readable description from an error.
 */
function describeError(e: unknown): string {
	const raw =
		e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
	const firstLine = raw.split(/\r?\n/).find((line) => line.trim().length > 0);
	return firstLine && firstLine.trim().length > 0
		? firstLine
		: "validation failed";
}

async function main(): Promise<void> {
	let output: string;
	try {
		const raw = await readStdin();
		const doc: unknown = JSON.parse(raw);

		// The stdin document is expected to be `{ "params": { ... } }`.
		const params =
			doc && typeof doc === "object" && "params" in doc
				? (doc as { params: unknown }).params
				: undefined;

		// `await` captures both synchronous throws (from parameter validation
		// at the `type.fn` boundary) and rejected promises (from resolved-value
		// validation inside the async body).
		const result = await fetchWithTimeout(params as never);

		output = `OK ${JSON.stringify(result)}`;
	} catch (e) {
		output = `ERR ${describeError(e)}`;
	}

	process.stdout.write(`${output}\n`);
	// Both success and validation-failure paths exit with code 0.
	process.exit(0);
}

void main();