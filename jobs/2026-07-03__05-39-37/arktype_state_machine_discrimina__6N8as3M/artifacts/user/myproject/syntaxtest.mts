import { type, type ArkErrors } from "arktype";

const tests: Array<[string, unknown]> = [
  ["number % 1", 5],
  ["number % 1", 5.5],
  ["number % 1 >= 0", 5],
  ["number % 1 >= 0", -1],
  ["number % 1 >= 400 <= 599", 500],
  ["number % 1 >= 400 <= 599", 399],
  ["number % 1 >= 400 <= 599", 600],
  ["number % 1 >= 400 <= 599", 500.9],
  ["string >= 1 <= 200", "hi"],
  ["string >= 1 <= 200", ""],
  ["string >= 1 <= 200", "x".repeat(201)],
  ["string >= 1", "hi"],
  ["string <= 200", "x".repeat(201)],
];

for (const [def, val] of tests) {
  let t;
  try { t = type(def as never); } catch (e) { console.log(def.padEnd(28), "PARSE ERR", (e as Error).message); continue; }
  const out = t(val);
  const ok = !(out instanceof type.errors);
  console.log(def.padEnd(28), JSON.stringify(val).slice(0,20).padEnd(22), ok ? "OK" : `FAIL ${(out as ArkErrors).summary}`);
}
