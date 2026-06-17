import { Order } from "./src/keywords.js";
import * as fs from "fs";

function run() {
    try {
        const input = fs.readFileSync(0, "utf-8");
        const data = JSON.parse(input);
        const validated = Order.assert(data);
        console.log("VALID");
        console.log(JSON.stringify(validated));
    } catch (e: any) {
        console.log(`INVALID: ${e.message}`);
    }
}

run();
