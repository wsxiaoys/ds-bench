import { scope } from "arktype";
import * as fs from "fs";

const apiScope = scope({
    success: { status: "'success'", data: "object" },
    error: { status: "'error'", code: "number", reason: "string" },
    pending: { status: "'pending'" }
});

const handler = apiScope.match({
    success: (payload) => `OK: ${JSON.stringify(payload.data)}`,
    error: (payload) => `ERR ${payload.code} ${payload.reason}`,
    pending: () => "PENDING",
    default: "assert"
});

function main() {
    try {
        const input = fs.readFileSync(0, "utf-8");
        if (!input.trim()) return;
        const json = JSON.parse(input);
        const result = handler(json);
        console.log(result);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
