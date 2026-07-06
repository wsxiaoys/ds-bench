import { Order } from "./src/keywords.js";

/**
 * Read the entire stdin payload as a UTF-8 string. Streams are read
 * asynchronously so large inputs do not block the event loop.
 */
const readStdin = async (): Promise<string> => {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
};

/**
 * Collapse a multi-line ArkType error message into a single short line so the
 * CLI output remains predictable on a single terminal line.
 */
const summarizeError = (raw: string): string => {
	// Strip the "TraversalError: " (or similar) prefix arktype prepends.
	const withoutPrefix = raw.replace(/^[A-Za-z]+(?:Error)?:\s*/, "");
	// Collapse newlines and surrounding whitespace into single spaces.
	const singleLine = withoutPrefix.replace(/\s+/g, " ").trim();
	return singleLine;
};

const main = async (): Promise<void> => {
	let payload: string;
	try {
		payload = await readStdin();
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		process.stdout.write(`INVALID: failed to read stdin (${message})\n`);
		process.exit(0);
		return;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(payload);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		process.stdout.write(`INVALID: malformed JSON (${message})\n`);
		process.exit(0);
		return;
	}

	try {
		const validated = Order.assert(parsed);
		process.stdout.write("VALID\n");
		process.stdout.write(`${JSON.stringify(validated)}\n`);
	} catch (e) {
		const raw = e instanceof Error ? e.message : String(e);
		process.stdout.write(`INVALID: ${summarizeError(raw)}\n`);
	}

	// Always exit successfully so downstream tooling does not need to
	// distinguish "validation failed" from "the validator itself crashed".
	process.exit(0);
};

await main();