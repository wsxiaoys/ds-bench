import * as fs from "node:fs";
import { validateGraph } from "./src/validator.js";

function main() {
    let inputData = "";
    try {
        inputData = fs.readFileSync(0, "utf-8");
    } catch (err: any) {
        console.log(`INVALID: Failed to read from stdin: ${err.message}`);
        process.exit(0);
    }

    if (!inputData.trim()) {
        console.log("INVALID: Empty input");
        process.exit(0);
    }

    let parsed: any;
    try {
        parsed = JSON.parse(inputData);
    } catch (err: any) {
        console.log(`INVALID: Invalid JSON: ${err.message}`);
        process.exit(0);
    }

    if (typeof parsed !== "object" || parsed === null) {
        console.log("INVALID: Input payload must be a JSON object");
        process.exit(0);
    }

    if (!("graph" in parsed)) {
        console.log("INVALID: Missing 'graph' key in the input payload");
        process.exit(0);
    }

    try {
        const validated = validateGraph(parsed.graph);
        console.log("VALID");
        console.log(JSON.stringify(validated));
    } catch (err: any) {
        // Clean up or format the error message to be on one line
        const errMsg = err.message ? err.message.replace(/\s+/g, " ") : String(err);
        console.log(`INVALID: ${errMsg}`);
    }
    process.exit(0);
}

main();
