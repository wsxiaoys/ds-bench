"use strict";

const { match, scope } = require("arktype");

/**
 * Named type aliases for each supported metric unit.
 *
 * Defining them in a `scope` lets us reference them by name as keys in the
 * `match({...})` call below, keeping the canonical `match({...})({...})`
 * structure intact while still matching full object shapes.
 */
const $ = scope({
  Length: { kind: '"length"', meters: "number" },
  Mass: { kind: '"mass"', kilograms: "number" },
  Temperature: { kind: '"temperature"', celsius: "number" },
});

/**
 * Unit converter built on ArkType's `match` API.
 *
 * Each case key is a named type (resolved from the scope above) and each
 * value is a handler that converts the matched metric value into a formatted
 * imperial-unit string.
 *
 * `default: "assert"` guarantees exhaustiveness: any input that does not match
 * one of the declared cases causes the matcher to throw.
 */
const convert = $.match({
  Length: (o) => `${(o.meters * 3.28084).toFixed(2)} ft`,

  Mass: (o) => `${(o.kilograms * 2.20462).toFixed(2)} lb`,

  Temperature: (o) => `${((o.celsius * 9) / 5 + 32).toFixed(2)} °F`,

  default: "assert",
});

// ---------------------------------------------------------------------------
// Read a single JSON object from STDIN, dispatch it through the matcher,
// and print the resulting imperial-unit string to STDOUT.
// ---------------------------------------------------------------------------
let raw = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});

process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    const result = convert(input);
    console.log(result);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
});