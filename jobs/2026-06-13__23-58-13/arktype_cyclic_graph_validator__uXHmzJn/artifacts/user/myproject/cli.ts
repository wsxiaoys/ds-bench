import { validateGraph } from "./src/validator.js";

async function readStdin(): Promise<string> {
    let result = "";
    for await (const chunk of process.stdin) {
        result += chunk;
    }
    return result;
}

async function main() {
    try {
        const inputStr = await readStdin();
        const inputJson = JSON.parse(inputStr);
        
        if (!inputJson || typeof inputJson !== "object" || !("graph" in inputJson)) {
            console.log("INVALID: Input must be an object with a 'graph' property");
            process.exit(0);
        }
        
        const validatedGraph = validateGraph(inputJson.graph);
        console.log("VALID");
        console.log(JSON.stringify(validatedGraph));
    } catch (err: any) {
        // Ensure exactly one line starting with INVALID:
        const singleLineMsg = err.message.replace(/\n/g, " | ");
        console.log(`INVALID: ${singleLineMsg}`);
    }
}

main();
