import * as fs from "fs";
import { signupSchema } from "./src/validator.js";
import { type } from "arktype";

function main() {
    let inputStr = "";
    try {
        inputStr = fs.readFileSync(0, "utf-8");
    } catch (e) {
        console.log("INVALID: " + JSON.stringify({ error: "Failed to read from stdin" }));
        process.exit(0);
    }

    let inputObj: any;
    try {
        inputObj = JSON.parse(inputStr);
    } catch (e: any) {
        console.log("INVALID: " + JSON.stringify({ error: "Invalid JSON input: " + e.message }));
        process.exit(0);
    }

    const result = signupSchema(inputObj);

    if (result instanceof type.errors) {
        const rawPassword = inputObj?.password;
        const rawConfirm = inputObj?.confirm;
        const rawSsn = inputObj?.ssn;

        function redactRawValues(value: any): any {
            if (typeof value === "string") {
                let res = value;
                const sensitiveValues = [rawPassword, rawConfirm, rawSsn].filter(
                    v => typeof v === "string" && v.length > 0
                );
                sensitiveValues.sort((a, b) => b.length - a.length);
                for (const sensitive of sensitiveValues) {
                    res = res.split(sensitive).join("<redacted>");
                }
                return res;
            } else if (Array.isArray(value)) {
                return value.map(redactRawValues);
            } else if (value !== null && typeof value === "object") {
                const res: any = {};
                for (const key of Object.keys(value)) {
                    res[key] = redactRawValues(value[key]);
                }
                return res;
            }
            return value;
        }

        const rawJson = JSON.stringify({
            errors: result,
            byPath: result.byPath,
            flatByPath: result.flatByPath,
            flatProblemsByPath: result.flatProblemsByPath,
            summary: result.summary,
        });

        const parsedJson = JSON.parse(rawJson);
        const redactedParsed = redactRawValues(parsedJson);

        console.log("INVALID: " + JSON.stringify(redactedParsed));
        process.exit(0);
    } else {
        console.log("VALID");
        console.log(JSON.stringify(result));
        process.exit(0);
    }
}

main();
