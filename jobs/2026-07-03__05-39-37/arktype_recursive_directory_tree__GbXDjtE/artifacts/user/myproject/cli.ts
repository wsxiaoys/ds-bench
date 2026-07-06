import { validateDirectoryTree } from "./src/validator.js"

async function readStdin(): Promise<string> {
	let data = ""
	process.stdin.setEncoding("utf8")
	for await (const chunk of process.stdin) {
		data += chunk
	}
	return data
}

async function main(): Promise<void> {
	const raw = await readStdin()

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch (error) {
		console.log(`INVALID: ${error instanceof Error ? error.message : String(error)}`)
		return
	}

	try {
		const result = validateDirectoryTree(parsed)
		console.log("VALID")
		console.log(JSON.stringify(result))
	} catch (error) {
		console.log(`INVALID: ${error instanceof Error ? error.message : String(error)}`)
	}
}

main().catch(error => {
	console.log(`INVALID: ${error instanceof Error ? error.message : String(error)}`)
})