import { fetchWithTimeout } from "./src/validator.js";
import { readFileSync } from "node:fs";

async function main(): Promise<void> {
	const input = readFileSync(0, "utf-8").trim();
	let parsed: { params: unknown };
	try {
		parsed = JSON.parse(input);
	} catch {
		console.log("ERR Invalid JSON input");
		return;
	}

	try {
		const result = await fetchWithTimeout(parsed.params);
		console.log(`OK ${JSON.stringify(result)}`);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.log(`ERR ${msg}`);
	}
}

main();