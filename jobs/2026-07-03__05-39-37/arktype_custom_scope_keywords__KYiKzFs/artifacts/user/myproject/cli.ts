import { readFileSync } from "node:fs"
import { Order } from "./src/keywords.js"

/**
 * Read a single JSON payload from stdin and validate it against the `Order`
 * schema.
 *
 * On success: prints `VALID` on the first line followed by the
 * JSON-stringified validated object on the second line.
 * On failure: prints a single line beginning with `INVALID: ` followed by a
 * short error description.
 * The process always exits with code 0.
 */
function readStdin(): string {
	// Reading synchronously from fd 0 works whether or not stdin is a TTY.
	return readFileSync(0, "utf8")
}

function main(): void {
	const raw = readStdin()

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch (error) {
		console.log(`INVALID: ${error instanceof Error ? error.message : "malformed JSON"}`)
		return
	}

	try {
		const result = Order.assert(parsed)
		console.log("VALID")
		console.log(JSON.stringify(result))
	} catch (error) {
		const message =
			error instanceof Error ? error.message : String(error)
		console.log(`INVALID: ${message}`)
	}
}

main()