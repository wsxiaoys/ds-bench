import * as fs from "fs";
import { fetchWithTimeout } from "./src/validator.js";

async function main() {
    try {
        const input = fs.readFileSync(0, "utf-8").trim();
        if (!input) {
            console.log("ERR Input is empty");
            return;
        }

        let parsedInput;
        try {
            parsedInput = JSON.parse(input);
        } catch (err: any) {
            console.log(`ERR Invalid JSON input: ${err.message || err}`);
            return;
        }

        if (!parsedInput || typeof parsedInput !== "object" || !("params" in parsedInput)) {
            console.log("ERR Input JSON must contain a 'params' key");
            return;
        }

        // Await a single call to fetchWithTimeout
        // Both synchronous throws and rejected promises are caught in the outer try-catch
        const result = await fetchWithTimeout(parsedInput.params);
        console.log(`OK ${JSON.stringify(result)}`);
    } catch (err: any) {
        console.log(`ERR ${err.message || err}`);
    }
}

main();
