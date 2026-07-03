import { attest } from "@arktype/attest"
import { type } from "arktype"
import { describe, it, expect } from "vitest"
import {
	Event,
	ParsedNumber,
	Role,
	TreeNode
} from "../src/schemas.ts"

describe("Role (literal-string union)", () => {
	it("infers to the literal-string union exactly", () => {
		// Pure compile-time type-equality check using `attest<T>(...)`.
		// No chained assertion after the call: `setup()` records and checks
		// the type-equality via cached metadata.
		attest<"admin" | "user" | "guest">(Role.infer)
	})

	it("serializes to the literal union string form", () => {
		// `.type.toString.equals(...)` is one of the two forms the contract
		// permits (the other being `.snap(...)`).
		attest(Role.infer).type.toString.equals('"admin" | "user" | "guest"')
	})

	it("rejects values not in the literal union at runtime", () => {
		// Pure runtime `.throws(...)` check on a thunk that should fail.
		attest(() => Role.assert("not-a-role")).throws(
			/must be "admin", "guest" or "user"/
		)
	})
})

describe("ParsedNumber (morph pipe)", () => {
	it("morphs numeric strings into numbers", () => {
		const out = ParsedNumber("42")
		expect(out).toBe(42)
		// Pure runtime equality check on the morph's output.
		attest(ParsedNumber("42")).equals(42)
	})

	it("rejects non-numeric strings", () => {
		// Pure runtime `.throws(...)` check on a morph that should fail.
		attest(() => ParsedNumber.assert("not-a-number")).throws(
			/must be a well-formed numeric string/
		)
	})
})

describe("TreeNode (recursive scope)", () => {
	it("accepts nested trees", () => {
		const out = TreeNode({
			value: "root",
			children: [{ value: "child", children: [] }]
		})
		expect(out).toEqual({
			value: "root",
			children: [{ value: "child", children: [] }]
		})
		// Runtime equality check on a recursive tree node's output.
		attest(out).equals({
			value: "root",
			children: [{ value: "child", children: [] }]
		})
	})
})

describe("Event (discriminated union)", () => {
	it("accepts the discriminator-tagged 'login' branch", () => {
		const out = Event({ kind: "login" })
		expect(out).toEqual({ kind: "login" })
		// Runtime equality check on the discriminated union's inferred output.
		attest(out).equals({ kind: "login" })
	})

	it("accepts the discriminator-tagged 'logout' branch with optional field", () => {
		const out = Event({ kind: "logout", timestamp: 1 })
		expect(out).toEqual({ kind: "logout", timestamp: 1 })
		// Runtime equality check on the discriminated union's optional field.
		attest(out).equals({ kind: "logout", timestamp: 1 })
	})

	it("rejects an unknown discriminator tag at runtime", () => {
		// Pure runtime `.throws(...)` check on the discriminated union.
		attest(() => Event.assert({ kind: "weird" })).throws(
			/must be "login" or "logout"/
		)
	})
})

describe("attest surfaces", () => {
	it("throwsAndHasTypeError on an invalid arktype DSL expression", () => {
		// `// @ts-expect-error` precedes the call because `type("number%0")`
		// fails `type.validate<...>` at the TypeScript level: `% 0` is an
		// invalid arktype divisor. The thunk also throws at runtime, so
		// `throwsAndHasTypeError(...)` exercises both the TypeScript-level
		// error and the matching runtime error message.
		// @ts-expect-error
		attest(() => type("number%0")).throwsAndHasTypeError(
			"% operator must be followed by a non-zero integer literal (was 0)"
		)
	})

	it("completions snapshot on a string-literal property value", () => {
		// `// @ts-expect-error` precedes the call because `{ a: "a", b: "b" }`
		// is not a valid arktype type literal (the values `"a"`/`"b"` are
		// untyped strings, not recognized arktype keywords). The completions
		// snapshot captures the available keyword completions for the
		// untyped string values.
		// @ts-expect-error
		attest(() => type({ a: "a", b: "b" })).completions({
			a: ["any", "alpha", "alphanumeric"],
			b: ["bigint", "boolean"]
		})
	})
})
