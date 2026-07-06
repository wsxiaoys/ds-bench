import { ArkErrors, type } from "arktype"
import { CsvPipeline, type UserRecord } from "./src/pipeline.js"

/**
 * Read the entire raw CSV from stdin verbatim. The bytes are handed to the
 * ArkType pipeline without any trimming or normalization.
 */
async function readStdin(): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer)
	}
	return Buffer.concat(chunks).toString("utf8")
}

function fail(message: string): never {
	console.log(`INVALID: ${message}`)
	process.exit(0)
}

async function main(): Promise<void> {
	const raw = await readStdin()

	const result = CsvPipeline(raw)

	if (result instanceof ArkErrors) {
		fail(result.summary.replace(/\n/g, " "))
	}

	const records = result as UserRecord[]
	console.log("VALID")
	console.log(JSON.stringify(records))
}

main().catch((error: unknown) => {
	const message =
		error instanceof Error ? error.message : String(error)
	fail(message)
})