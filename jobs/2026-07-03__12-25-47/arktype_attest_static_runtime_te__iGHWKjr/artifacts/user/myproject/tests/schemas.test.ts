import { describe, it, expect } from "vitest"
import { type } from "arktype"
import { attest } from "@arktype/attest"
import {
	Role,
	Category,
	Event,
	TrimmedEmail,
	UpperName
} from "../src/schemas.ts"

describe("ArkType schemas with @arktype/attest", () => {
	it("Role is a literal-string union", () => {
		// (2) attest(<literal string union>).type.toString.snap(...)
		attest(Role.infer).type.toString.snap("'admin' | 'editor' | 'guest' | 'viewer'")
		// (1) Pure compile-time type-equality check (no runtime actual passed)
		attest<"admin" | "editor" | "viewer" | "guest", typeof Role.infer>()

		// Runtime sanity
		const ok = Role("admin")
		attest(ok).snap("admin")

		// (3) Runtime throws — invalid literal should reject
		const err = Role("notarole")
		attest(err).throws.snap(
			'must be "admin", "editor", "guest" or "viewer" (was a string)'
		)
	})

	it("Category is a recursive scope-exported type", () => {
		// (4) toString snapshot for the recursive alias
		attest(Category.infer).type.toString.snap(
			"{ name: string; children?: Category[]; }"
		)

		// Runtime value works for nested recursive input
		const nested = Category({
			name: "root",
			children: [{ name: "a" }, { name: "b", children: [{ name: "c" }] }]
		})
		attest(nested).snap({
			name: "root",
			children: [
				{ name: "a" },
				{ name: "b", children: [{ name: "c" }] }
			]
		})

		// Missing required `name` should error at runtime
		const catErr = Category({ name: 5 } as { name: string })
		attest(catErr).throws.snap("name must be a string (was a number)")
	})

	it("Event is a discriminated union on `kind`", () => {
		// (5) Type toString snap
		attest(Event.infer).type.toString.snap(
			`{
				amount: number
				kind: "purchase"
			}
			& {
					kind: "logout"
			}
			& {
					kind: "login"
			}`
		)

		// Runtime: each tag should be validated correctly
		attest(Event({ kind: "login" })).snap({ kind: "login" })
		attest(Event({ kind: "purchase", amount: 9.99 })).snap({
			kind: "purchase",
			amount: 9.99
		})

		// Throwing assertion: a `purchase` event missing amount
		const evErr = Event({ kind: "purchase" })
		attest(evErr).throws.snap("amount must be a number (was undefined)")
	})

	it("TrimmedEmail — built-in morph pipe on `string.trim`", () => {
		// Runtime: morph trims surrounding whitespace
		const trimmed = TrimmedEmail("   hello@example.com   ")
		attest(trimmed).snap("hello@example.com")
		attest(TrimmedEmail("plain")).snap("plain")

		// Non-string should throw
		const e = TrimmedEmail(123)
		attest(e).throws.snap("must be a string (was a number)")
	})

	it("UpperName — morph pipe with `|>` operator", () => {
		// Trim+upper output
		attest(UpperName("  alice  ")).snap("ALICE")
		attest(UpperName("bob")).snap("BOB")

		// Pure compile-time type equality check
		attest<string, typeof UpperName.infer>()

		// Negative compile-time assertion guarded by @ts-expect-error:
		// the morph output type is `string`, not the literal `"ALICE"`.
		// @ts-expect-error — output type does not narrow to a string literal
		attest(() => UpperName("  alice  ")).throwsAndHasTypeError(
			/Type 'string' is not assignable to type '"ALICE"'"/
		)
	})

	it("completion snapshots are populated with @ts-expect-error", () => {
		// (6) Completions: snapshot the builtin keywords completions for a `type` parser.
		// The deliberately-broken type expression below is guarded by @ts-expect-error.
		// @ts-expect-error — `number%0` is a divider-by-zero error in arktype
		attest(() => type("number%0")).completions({
			"0": ["0%", "0..", "0d"]
		})
	})
})
