import { validateDiscount } from "./src/validator.js";

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(
			typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer),
		);
	}
	return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
	const raw = await readStdin();

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stdout.write(`INVALID: ${message}\n`);
		return;
	}

	const result = validateDiscount(parsed);

	if (result.valid) {
		process.stdout.write(`VALID\n${JSON.stringify(result.data)}\n`);
	} else {
		process.stdout.write(`INVALID: ${result.error}\n`);
	}
}

main().then(
	() => {
		process.exit(0);
	},
	(err: unknown) => {
		const message = err instanceof Error ? err.message : String(err);
		process.stdout.write(`INVALID: ${message}\n`);
		process.exit(0);
	},
);
