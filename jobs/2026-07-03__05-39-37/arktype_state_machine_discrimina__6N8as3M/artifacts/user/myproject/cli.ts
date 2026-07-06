import { ArkErrors, type } from "arktype";
import { State, transition } from "./src/statemachine.js";

/**
 * CLI entrypoint.
 *
 * Reads a single JSON document from stdin with the shape:
 *   { "initial": <State>, "events": [<Event>, ...] }
 *
 * Replays the events through `transition` in order and prints the outcome:
 *   - On success:   first non-empty line is `VALID`, followed by a
 *                    JSON-stringified final `State`.
 *   - On failure:    a single non-empty line beginning with `INVALID: `.
 *
 * Always exits with code 0, even when the input is rejected.
 */

/** Describe any error value as a single-line string for the INVALID output. */
function describeError(error: unknown): string {
    if (error instanceof ArkErrors) {
        return error.summary;
    }
    // `type.fn` throws a `TraversalError` which carries `ArkErrors` and whose
    // `message` is the ArkErrors summary.
    if (error instanceof Error && "arkErrors" in error && error.arkErrors instanceof ArkErrors) {
        return (error.arkErrors as ArkErrors).summary;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/** Read all of stdin as a single string. */
function readStdin(): Promise<string> {
    return new Promise((resolve) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => {
            data += chunk;
        });
        process.stdin.on("end", () => resolve(data));
    });
}

async function main(): Promise<void> {
    const input = await readStdin();

    // Parse the envelope JSON document.
    let envelope: unknown;
    try {
        envelope = JSON.parse(input);
    } catch (error) {
        process.stdout.write(`INVALID: malformed JSON input: ${describeError(error)}\n`);
        return;
    }

    // Validate the envelope shape { initial, events }.
    if (
        typeof envelope !== "object" ||
        envelope === null ||
        Array.isArray(envelope)
    ) {
        process.stdout.write(
            "INVALID: input must be a JSON object with \"initial\" and \"events\" fields\n",
        );
        return;
    }

    const { initial, events } = envelope as Record<string, unknown>;

    if (!Array.isArray(events)) {
        process.stdout.write(
            "INVALID: \"events\" must be an array of events\n",
        );
        return;
    }

    // Validate the initial state against `State` (non-throwing).
    const initialValidated = State(initial);
    if (initialValidated instanceof type.errors) {
        process.stdout.write(
            `INVALID: initial state: ${initialValidated.summary}\n`,
        );
        return;
    }

    // Replay events through the runtime-validated transition function.
    let current = initialValidated;
    for (let i = 0; i < events.length; i++) {
        try {
            // `transition` validates both the state and the event, and
            // validates its returned state. Any failure throws here.
            current = transition(current, events[i]);
        } catch (error) {
            process.stdout.write(
                `INVALID: event ${i}: ${describeError(error)}\n`,
            );
            return;
        }
    }

    // Success.
    process.stdout.write("VALID\n");
    process.stdout.write(`${JSON.stringify(current)}\n`);
}

main().catch((error) => {
    // Should not happen, but never crash: report as INVALID and exit 0.
    process.stdout.write(`INVALID: unexpected error: ${describeError(error)}\n`);
});