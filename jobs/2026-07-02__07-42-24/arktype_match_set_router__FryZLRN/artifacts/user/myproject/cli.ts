import * as fs from "node:fs"
import { route } from "./src/router.js"
import { TraversalError } from "arktype"

function main() {
	let input = ""
	try {
		input = fs.readFileSync(0, "utf-8")
	} catch (err) {
		// If reading stdin fails, exit gracefully with 0
		process.exit(0)
	}

	let data: any
	try {
		data = JSON.parse(input)
	} catch (err) {
		// If JSON parsing fails, exit gracefully with 0
		process.exit(0)
	}

	if (!data || !Array.isArray(data.events)) {
		// If events array is missing, exit gracefully with 0
		process.exit(0)
	}

	for (const event of data.events) {
		try {
			const result = route(event)
			console.log(result)
		} catch (err) {
			if (err instanceof TraversalError) {
				console.log(`ERR ${err.message}`)
				break
			} else {
				console.log(`ERR ${err instanceof Error ? err.message : String(err)}`)
				break
			}
		}
	}
}

main()
