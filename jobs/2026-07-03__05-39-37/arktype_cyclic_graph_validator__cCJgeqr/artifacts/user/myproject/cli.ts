#!/usr/bin/env node
import { validateGraph } from "./src/validator.js";

async function readStdin(): Promise<string> {
	return await new Promise((resolve, reject) => {
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
		process.stdout.write(`INVALID: ${err instanceof Error ? err.message : String(err)}\n`);
		return;
	}

	// The CLI payload is expected to be `{"graph": <Graph>}`.
	if (parsed === null || typeof parsed !== "object" || !("graph" in parsed)) {
		process.stdout.write("INVALID: input must be an object with a \"graph\" property\n");
		return;
	}

	const payload = parsed as { graph: unknown };

	try {
		const graph = validateGraph(payload.graph);
		process.stdout.write("VALID\n");
		process.stdout.write(`${JSON.stringify(graph)}\n`);
	} catch (err) {
		const description = err instanceof Error ? err.message : String(err);
		// Collapse to a single line so the reject output is exactly one line.
		const singleLine = description.replace(/\s+/g, " ").trim();
		process.stdout.write(`INVALID: ${singleLine}\n`);
	}
}

main().catch((err) => {
	const description = err instanceof Error ? err.message : String(err);
	const singleLine = description.replace(/\s+/g, " ").trim();
	process.stdout.write(`INVALID: ${singleLine}\n`);
});