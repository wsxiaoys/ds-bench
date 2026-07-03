import { match } from "arktype";

/**
 * Use ArkType's `match` record API to discriminate on the `status` field of
 * an API payload and produce a formatted string. The cases are passed as an
 * object literal where each key is an ArkType definition string naming the
 * literal value of `status`. Any payload whose `status` does not match one
 * of the declared branches is rejected by the `"assert"` default, which
 * throws a `TraversalError`.
 */
const formatPayload = match.at("status", {
    "'success'": ({ data }) => `OK: ${JSON.stringify(data)}`,
    "'error'": ({ code, reason }) => `ERR ${code} ${reason}`,
    "'pending'": () => "PENDING",
    default: "assert",
});

async function readStdin(): Promise<string> {
    // Buffer stdin chunks into a single string. This works regardless of
    // whether the input is sent via a pipe or typed interactively.
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
    // Read the entire stdin payload, parse it as JSON, dispatch it to the
    // ArkType matcher, then write the formatted result to stdout followed
    // by a newline. Any thrown error (e.g. from an unmatched input or an
    // invalid JSON document) propagates out of `main` and causes Node to
    // exit with a non-zero status code via the `.catch` handler below.
    const raw = await readStdin();
    const input: unknown = JSON.parse(raw);
    const result = formatPayload(input);
    process.stdout.write(`${result}\n`);
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
