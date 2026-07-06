import * as fs from "node:fs"
import { validateDirectoryTree } from "./src/validator.js"

function main() {
    let inputStr = ""
    try {
        inputStr = fs.readFileSync(0, "utf-8")
    } catch (err: any) {
        console.log(`INVALID: Failed to read from stdin: ${err?.message || String(err)}`)
        process.exit(0)
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(inputStr)
    } catch (err: any) {
        console.log(`INVALID: Malformed JSON: ${err?.message || String(err)}`)
        process.exit(0)
    }

    try {
        const validated = validateDirectoryTree(parsed)
        console.log("VALID")
        console.log(JSON.stringify(validated))
    } catch (err: any) {
        console.log(`INVALID: ${err?.message || String(err)}`)
    }
}

main()
