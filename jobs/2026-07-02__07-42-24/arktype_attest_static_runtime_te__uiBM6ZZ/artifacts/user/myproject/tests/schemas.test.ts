import { describe, it } from "vitest"
import { attest } from "@arktype/attest"
import { type } from "arktype"
import { role, parsedNumber, LinkedList, vehicle } from "../src/schemas.js"

describe("ArkType Schemas tests", () => {
	it("exercises all required attest surfaces and schemas", () => {
		// 1. Pure compile-time type-equality check using the attest<T>(...) type-argument form
		attest<"admin" | "user" | "guest">(role.infer)

		// 2. A attest(...).type.toString.snap(...) check on a type's serialized string
		// prettier-ignore
		attest(role.infer).type.toString.snap('"admin" | "user" | "guest"')

		// 3. A runtime attest(() => ...).throws(...) check on an ArkType assertion that should fail (on a thunk)
		attest(() => role.assert("invalid" as any)).throws()

		// 4. A attest(() => ...).throwsAndHasTypeError(...) check guarded by a // @ts-expect-error directive
		// @ts-expect-error
		attest(() => type("invalid_type_name")).throwsAndHasTypeError("invalid_type_name")

		// 5. A attest(...).completions({...}) check guarded by a // @ts-expect-error directive
		// @ts-expect-error
		attest(() => type("ne")).completions({ ne: ["never"] })

		// 6. Additional assertions to meet the requirement of at least 8 assertions
		// Pure compile-time type check on parsedNumber (morph output)
		attest<string | number>(parsedNumber.infer)

		// 7. Runtime morph behavior check
		attest(parsedNumber.assert("123")).equals(123)

		// 8. Runtime morph behavior check for non-numeric string
		attest(parsedNumber.assert("abc")).equals("abc")

		// 9. Pure compile-time type check on recursive type LinkedList
		type ExpectedLinkedList = {
			value: number
			next?: ExpectedLinkedList
		}
		attest<ExpectedLinkedList>(LinkedList.infer)

		// 10. Pure compile-time type check on discriminated union vehicle
		attest<{ type: "car"; doors: number } | { type: "bike"; gears: number }>(vehicle.infer)

		// 11. Runtime validation on discriminated union vehicle
		attest(vehicle.assert({ type: "car", doors: 4 })).equals({ type: "car", doors: 4 })
	})
})
