import { describe, it } from "vitest"
import { attest } from "@arktype/attest"
import { type } from "arktype"
import { StringToNumber, Node, Shape, Role } from "../src/schemas.js"

describe("ArkType schemas", () => {
	// 1. Pure compile-time type-equality check using attest<T>(value) form
	it("Role infers the correct literal union type", () => {
		attest<"admin" | "editor" | "viewer">(Role.infer)
	})

	// 2. Type serialized string check using .type.toString.snap(...)
	it("StringToNumber morph outputs number type", () => {
		attest(StringToNumber.infer).type.toString.snap("number")
	})

	// 3. Runtime throws check on a failing ArkType assertion
	it("Role.assert throws for an invalid role string", () => {
		attest(() => Role.assert("superadmin" as any)).throws(/superadmin/)
	})

	// 4. throwsAndHasTypeError with @ts-expect-error
	it("invalid modulo expression throws and has type error", () => {
		// @ts-expect-error
		attest(() => type("number%0")).throwsAndHasTypeError(/% operator/)
	})

	// 5. completions with @ts-expect-error
	it("type keyword completions for partial strings", () => {
		// @ts-expect-error
		attest(() => type({ x: "bi" })).completions({
			"bi": ["bigint"]
		})
	})

	// 6. Type serialized string check using .type.toString direct call with regex
	it("Role type serializes to a union including admin", () => {
		attest(Role.infer).type.toString(/admin/)
	})

	// 7. Discriminated union type check
	it("Shape infers a discriminated union with kind", () => {
		attest(Shape.infer).type.toString(/kind/)
	})

	// 8. Recursive scope type check — Node references itself (appears as "cyclic")
	it("Node is a recursive type referencing itself", () => {
		attest(Node.infer).type.toString(/cyclic/)
	})
})