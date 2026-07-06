import { readFileSync } from "node:fs";
import { ArkErrors } from "@ark/schema";
import { Order } from "./src/keywords.ts";

function main(): void {
    let stdinText: string;
    try {
        stdinText = readFileSync(0, "utf8");
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`INVALID: ${message}`);
        return;
    }
    let data: unknown;
    try {
        data = JSON.parse(stdinText);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`INVALID: ${message}`);
        return;
    }
    try {
        const result = Order(data);
        if (result instanceof ArkErrors) {
            console.log(`INVALID: ${result.summary}`);
        } else {
            console.log("VALID");
            console.log(JSON.stringify(result));
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`INVALID: ${message}`);
    }
}

main();
