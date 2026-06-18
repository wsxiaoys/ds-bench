#!/usr/bin/env node
"use strict";

const { scope } = require("arktype");

// ── 1. Define a scope whose exported names serve as match-case keys ──────────
const conversions = scope({
  length:      { kind: '"length"',      meters:     "number" },
  mass:        { kind: '"mass"',        kilograms:  "number" },
  temperature: { kind: '"temperature"', celsius:    "number" },
});

// ── 2. Build the converter with match({...})({...}) + default:"assert" ───────
//
//  conversions.match  is ArkType's `match` bound to this scope.
//  The first call  match({ length: fn, mass: fn, temperature: fn })
//    → accumulates branches and returns the chained parser (no default yet).
//  The second call ({ default: "assert" })
//    → seals the union and returns the final dispatch function.
//
const convert = conversions.match({
  length:      (d) => `${(d.meters     * 3.28084).toFixed(2)} ft`,
  mass:        (d) => `${(d.kilograms  * 2.20462).toFixed(2)} lb`,
  temperature: (d) => `${((d.celsius * 9) / 5 + 32).toFixed(0)} °F`,
})({ default: "assert" });

// ── 3. Read JSON from STDIN and print the result ─────────────────────────────
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(raw);
  const result = convert(input);
  process.stdout.write(result + "\n");
});
