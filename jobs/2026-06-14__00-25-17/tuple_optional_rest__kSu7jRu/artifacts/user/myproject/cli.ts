import { TraversalError } from "arktype";
import { emit } from "./src/emit.js";

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
	chunks.push(chunk);
}
const input = Buffer.concat(chunks).toString("utf-8");
const { args } = JSON.parse(input.trim());

try {
	const result = emit(...(args as []));
	console.log(`OK ${JSON.stringify(result)}`);
} catch (e) {
	if (e instanceof TraversalError) {
		console.log(`ERR ${e.message}`);
	} else {
		throw e;
	}
}