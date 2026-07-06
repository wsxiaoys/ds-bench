#!/usr/bin/env node
import { type } from "arktype";
import { Discount } from "./src/validator.js";

/**
 * CLI entrypoint.
 *
 * Reads a single JSON payload representing one `Discount` object from stdin,
 * validates it, and prints:
 *   - On success: the line `VALID` followed by the JSON-stringified object.
 *   - On failure: a line starting with `INVALID: ` followed by an error description.
 *
 * Exits with code 0 in both cases.
 */

function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
}

async function main(): Promise<void> {
	const raw = await readStdin();

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		console.log(`INVALID: ${err instanceof Error ? err.message : String(err)}`);
		return;
	}

	const result = Discount(parsed);
	if (result instanceof type.errors) {
		console.log(`INVALID: ${result.summary}`);
		return;
	}

	console.log("VALID");
	console.log(JSON.stringify(result));
}

main().catch((err) => {
	console.log(`INVALID: ${err instanceof Error ? err.message : String(err)}`);
});