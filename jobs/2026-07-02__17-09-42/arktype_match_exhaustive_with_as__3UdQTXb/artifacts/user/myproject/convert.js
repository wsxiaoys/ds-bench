// convert.js
// Node.js CLI that reads a single JSON object from STDIN and prints a
// formatted imperial-unit conversion to STDOUT.
//
// Dispatch is performed by ArkType's `match` API with `default: "assert"`
// configured for exhaustive matching. Each case key is an ArkType type
// expression – quoted string literals (`'length'`, etc.) – that gets
// compiled to a discriminator on the `kind` property via `.at("kind")`.

import { match } from "arktype";

// ----- STDIN helpers ---------------------------------------------------------

/** Read all of STDIN into a single UTF-8 string. */
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}

// ----- Conversion helpers ---------------------------------------------------

const METER_TO_FEET = 3.28084; // 1 m = 3.28084 ft
const KG_TO_POUNDS = 2.20462; // 1 kg = 2.20462 lb

const celsiusToFahrenheit = (c) => (c * 9) / 5 + 32;

// ----- ArkType match dispatch ----------------------------------------------

// `match.at("kind").match({ ... })` builds an exhaustiveness checker that
// discriminates on the value of the input object's `kind` property. Each
// case key is the ArkType-syntax string literal for a permitted `kind`
// value, so `'length'` matches `{ kind: "length", ... }` input. The
// `default: "assert"` clause causes the matcher to throw an ArkErrors
// instance for inputs whose `kind` is not one of the listed cases – this
// is the explicit exhaustiveness configuration the task requires.
const convert = match
    .at("kind")
    .match({
        "'length'": ({ meters }) => {
            const feet = meters * METER_TO_FEET;
            return `${feet.toFixed(2)} feet (${meters} m)`;
        },
        "'mass'": ({ kilograms }) => {
            const pounds = kilograms * KG_TO_POUNDS;
            return `${pounds.toFixed(2)} pounds (${kilograms} kg)`;
        },
        "'temperature'": ({ celsius }) => {
            const fahrenheit = celsiusToFahrenheit(celsius);
            return `${fahrenheit.toFixed(2)} Fahrenheit (${celsius} \u00b0C)`;
        },
        default: "assert"
    });

// ----- Entrypoint -----------------------------------------------------------

try {
    const raw = await readStdin();
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        throw new Error("expected a JSON object on STDIN, got empty input");
    }
    const input = JSON.parse(trimmed);
    const result = convert(input);
    process.stdout.write(result + "\n");
} catch (err) {
    // Surface any failure (JSON parse error, unmatched kind, etc.) on stderr
    // and exit with a non-zero status. The matcher itself throws when no case
    // matches, satisfying the "unmatched inputs must cause the converter to
    // throw an error" requirement.
    const message = err && err.message ? err.message : String(err);
    process.stderr.write(`convert: ${message}\n`);
    process.exit(1);
}
