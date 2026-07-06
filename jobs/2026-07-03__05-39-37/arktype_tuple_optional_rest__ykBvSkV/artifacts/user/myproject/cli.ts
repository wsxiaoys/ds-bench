import * as fs from "node:fs";
import { TraversalError } from "arktype";
import { emit } from "./src/emit.js";

function readStdin(): string {
	// File descriptor 0 is stdin. Read it synchronously, then grab the first
	// (and only) JSON line we care about.
	const raw = fs.readFileSync(0, "utf-8");
	const firstLine = raw.split("\n", 1)[0] ?? "";
	return firstLine;
}

function main(): void {
	const line = readStdin();

	let args: unknown[];
	try {
		const parsed = JSON.parse(line) as { args: unknown[] };
		args = Array.isArray(parsed.args) ? parsed.args : [];
	} catch (e) {
		process.stdout.write(`ERR ${(e as Error).message}\n`);
		return;
	}

	try {
		const result = emit(...args);
		process.stdout.write(`OK ${JSON.stringify(result)}\n`);
	} catch (e) {
		if (e instanceof TraversalError) {
			process.stdout.write(`ERR ${e.message}\n`);
		} else {
			// Surface any unexpected error in the same ERR format so the
			// process still exits cleanly with code 0.
			process.stdout.write(`ERR ${(e as Error).message}\n`);
		}
	}
}

main();