#!/usr/bin/env node
/**
 * CLI entrypoint for the cyclic-graph validator.
 *
 * Input:  a single JSON payload `{"graph": <Graph>}` on stdin.
 * Output:
 *   - If accepted: prints "VALID\n" followed by a JSON-stringified Graph.
 *   - If rejected: prints "INVALID: <error description>" on a single line.
 *
 * Exit code is always 0 in both the accept and reject cases; the result is
 * communicated via stdout only.
 */
import { validateGraph } from "./src/validator.js";

async function readAllStdin(): Promise<string> {
	if (process.stdin.isTTY) return "";
	return await new Promise<string>((resolve, reject) => {
		const chunks: string[] = [];
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk: string) => chunks.push(chunk));
		process.stdin.on("end", () => resolve(chunks.join("")));
		process.stdin.on("error", (err: Error) => reject(err));
	});
}

function parseStdin(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === "") {
		throw new Error("empty input: expected a JSON payload on stdin");
	}
	try {
		return JSON.parse(trimmed);
	} catch (cause) {
		throw new Error(
			`could not parse stdin as JSON: ${(cause as Error).message}`
		);
	}
}

function extractGraph(payload: unknown): unknown {
	if (payload === null || typeof payload !== "object") {
		throw new Error("input payload must be a JSON object");
	}
	const obj = payload as Record<string, unknown>;
	if (!("graph" in obj)) {
		throw new Error("input payload must contain a `graph` property");
	}
	return obj.graph;
}

function invalid(message: string): void {
	process.stdout.write(`INVALID: ${message}\n`);
}

async function main(): Promise<void> {
	let rawStdin: string;
	try {
		rawStdin = await readAllStdin();
	} catch (cause) {
		invalid(`could not read stdin: ${(cause as Error).message}`);
		return;
	}

	let payload: unknown;
	try {
		payload = parseStdin(rawStdin);
	} catch (cause) {
		invalid((cause as Error).message);
		return;
	}

	let graphCandidate: unknown;
	try {
		graphCandidate = extractGraph(payload);
	} catch (cause) {
		invalid((cause as Error).message);
		return;
	}

	try {
		const graph = validateGraph(graphCandidate);
		process.stdout.write("VALID\n");
		process.stdout.write(`${JSON.stringify(graph)}\n`);
	} catch (cause) {
		const message = (cause as Error).message;
		invalid(message);
	}
}

main().catch((cause) => {
	const message =
		cause instanceof Error ? cause.message : (cause as { message?: string })?.message ?? String(cause);
	invalid(`unexpected error: ${message}`);
});
