import { attest } from "@arktype/attest"
import { type } from "arktype"
import { describe, it } from "vitest"
import { JsonValue, Role, Shape, TrimmedString } from "../src/schemas.js"

describe("Role – literal-string union", () => {
	it("accepts valid role values at runtime", () => {
		const result = Role("admin")
		attest(result).equals("admin")
	})

	it("rejects unknown roles at runtime", () => {
		attest(() => Role.assert("superuser")).throws(
			/must be "admin", "editor" or "viewer"/
		)
	})

	it("type is the literal union string (type.toString.snap)", () => {
		attest(Role.infer).type.toString.snap('"admin" | "editor" | "viewer"')
	})

	it("pure compile-time type-equality: Role.infer matches expected union", () => {
		attest<"admin" | "editor" | "viewer">(Role.infer)
	})
})

describe("TrimmedString – morph", () => {
	it("trims whitespace at runtime", () => {
		const out = TrimmedString.assert("  hello  ")
		attest(out).equals("hello")
	})

	it("type.toString reflects the morph output type", () => {
		attest(TrimmedString.infer).type.toString.snap("string")
	})
})

describe("Shape – discriminated union", () => {
	it("accepts a circle at runtime", () => {
		const c = Shape.assert({ kind: "circle", radius: 5 })
		attest(c).equals({ kind: "circle", radius: 5 })
	})

	it("rejects a shape with invalid radius type", () => {
		attest(() => Shape.assert({ kind: "circle", radius: "big" })).throws(
			/radius must be a number/
		)
	})

	it("pure type-equality: Shape.infer is the union of two shapes", () => {
		type ExpectedShape =
			| { kind: "circle"; radius: number }
			| { kind: "rectangle"; width: number; height: number }
		attest<ExpectedShape>(Shape.infer)
	})
})

describe("JsonValue – recursive scope type", () => {
	it("accepts a nested JSON structure at runtime", () => {
		const data = { a: 1, b: [true, null, "ok"] }
		const result = JsonValue.assert(data)
		attest(result).equals(data)
	})

	it("rejects undefined (not valid JSON)", () => {
		attest(() => JsonValue.assert(undefined as unknown)).throws(/must be/)
	})
})

describe("attest error and completions surfaces", () => {
	it("throwsAndHasTypeError on a bad type call", () => {
		// @ts-expect-error
		attest(() => type("nOtAkEyWoRd")).throwsAndHasTypeError(
			"nOtAkEyWoRd"
		)
	})

	it("completions snapshot for ArkType keyword prefix 'bo'", () => {
		// @ts-expect-error
		attest(() => type({ flag: "bo" })).completions({
			bo: ["boolean"]
		})
	})
})
