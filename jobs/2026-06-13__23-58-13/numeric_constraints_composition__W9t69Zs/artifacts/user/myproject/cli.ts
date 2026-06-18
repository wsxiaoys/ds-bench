import { validateDiscount } from "./src/validator.js";
import { type } from "arktype";

let inputData = "";
process.stdin.on("data", (chunk) => {
    inputData += chunk;
});

process.stdin.on("end", () => {
    try {
        const parsed = JSON.parse(inputData);
        const result = validateDiscount(parsed);
        if (result instanceof type.errors) {
            console.log("INVALID: " + result.toString().replace(/\n/g, " "));
        } else {
            console.log("VALID");
            console.log(JSON.stringify(result));
        }
    } catch (e: any) {
        console.log("INVALID: " + e.message.replace(/\n/g, " "));
    }
});
