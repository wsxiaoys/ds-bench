import * as fs from "fs";
import { validateDiscount } from "./src/validator.js";

function main() {
    try {
        const input = fs.readFileSync(0, "utf-8").trim();
        if (!input) {
            console.log("INVALID: Empty input");
            process.exit(0);
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(input);
        } catch (e: any) {
            console.log(`INVALID: Invalid JSON: ${e.message}`);
            process.exit(0);
        }

        const result = validateDiscount(parsed);
        if (result.success) {
            console.log("VALID");
            console.log(JSON.stringify(result.data));
        } else {
            console.log(`INVALID: ${result.error}`);
        }
    } catch (err: any) {
        console.log(`INVALID: Unexpected error: ${err.message}`);
    }
    process.exit(0);
}

main();
