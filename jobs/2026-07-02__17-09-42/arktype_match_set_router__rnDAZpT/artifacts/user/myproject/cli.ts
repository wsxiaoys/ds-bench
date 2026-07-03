import { readFileSync } from "node:fs";
import { route } from "./src/router.js";

interface InputDocument {
	events: unknown[];
}

/**
 * Read the entire stdin synchronously.
 */
function readStdin(): string {
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

function main(): void {
	const raw = readStdin();
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return;
	}

	let document: InputDocument;
	try {
		document = JSON.parse(trimmed) as InputDocument;
	} catch (err) {
		console.log(`ERR invalid JSON: ${(err as Error).message}`);
		return;
	}

	const events = Array.isArray(document.events) ? document.events : [];

	for (const event of events) {
		try {
			const result = route(event);
			console.log(result);
		} catch (err) {
			console.log(`ERR ${(err as Error).message}`);
			return;
		}
	}
}

main();