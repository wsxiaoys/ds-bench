import { route } from "./router.js";
import * as fs from "fs";

function main() {
    const input = fs.readFileSync(0, "utf-8");
    let doc: any;
    try {
        doc = JSON.parse(input);
    } catch (e) {
        process.exit(0);
    }

    if (!doc || !Array.isArray(doc.events)) {
        process.exit(0);
    }

    for (const event of doc.events) {
        try {
            const result = route(event);
            console.log(result);
        } catch (e: any) {
            console.log(`ERR ${e.message}`);
            break;
        }
    }
    process.exit(0);
}

main();
