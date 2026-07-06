import { type } from "arktype";

/**
 * This file intentionally constructs an *ambiguous* union: both branches
 * accept the same input (`string`), but one branch morphs it to `number`
 * while the other leaves it as `string`. Without a literal discriminator,
 * ArkType has no deterministic way to pick a branch, so it throws a
 * `ParseError` with `name === "ParseError"`.
 *
 * Run with: `npx tsx broken.ts`
 * Expected: a non-zero exit and "ParseError" printed to stdout/stderr.
 */
const Broken = type("string")
	.pipe((s: string) => s.length)
	.or("string");

// This call is never reached because the type construction above throws.
const _unused = Broken("hello");
console.log(_unused);