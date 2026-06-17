import { validateDirectoryTree } from "./src/validator.js";

async function readStdin() {
    let data = "";
    for await (const chunk of process.stdin) {
        data += chunk;
    }
    return data;
}

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr.trim()) {
             console.log("INVALID: empty input");
             process.exit(0);
        }
        const input = JSON.parse(inputStr);
        const validated = validateDirectoryTree(input);
        console.log("VALID");
        console.log(JSON.stringify(validated));
    } catch (e: any) {
        const msg = e.message ? e.message.replace(/\n/g, ' ') : String(e);
        console.log(`INVALID: ${msg}`);
    }
}

main();
