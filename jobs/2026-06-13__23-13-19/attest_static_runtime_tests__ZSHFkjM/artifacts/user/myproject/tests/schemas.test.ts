import { describe, it } from "vitest"
import { attest } from "@arktype/attest"
import { type } from "arktype"
import {
  roleUnion,
  userUnion,
  recursiveNode,
  trimmedString
} from "../src/schemas.js"

describe("ArkType Schema Tests with Attest", () => {
  it("exercises type-equality and toString assertions", () => {
    // 1. pure compile-time type-equality check using the attest<T>(...) type-argument form
    attest<"admin" | "user" | "guest">(roleUnion.infer)

    // 2. a attest(...).type.toString.equals(...) check on a type's serialized string
    attest(roleUnion.infer).type.toString.equals('"admin" | "user" | "guest"')

    // 3. another type-equality check
    attest<string>(trimmedString.infer)
  })

  it("exercises runtime and error assertions", () => {
    // 4. a runtime attest(() => ...).throws(...) check on an ArkType assertion that should fail
    attest(() => roleUnion.assert("invalid" as any)).throws()

    // 5. a attest(() => ...).throwsAndHasTypeError(...) check guarded by // @ts-expect-error
    // @ts-expect-error
    attest(() => type("number%0")).throwsAndHasTypeError(
      "% operator must be followed by a non-zero integer literal (was 0)"
    )

    // 6. a attest(...).completions({...}) check guarded by // @ts-expect-error
    // @ts-expect-error
    attest(() => type({ a: "a" })).completions({})
  })

  it("exercises other schema checks", () => {
    // 7. runtime value check on morph
    attest(trimmedString(" hello ")).equals("hello")

    // 8. type-equality assertion on recursive type
    attest<{ val: number; next?: any }>(recursiveNode.infer)

    // 9. value validation check on discriminated union
    attest(userUnion.assert({ role: "admin", adminCode: "123" })).equals({
      role: "admin",
      adminCode: "123"
    })
  })
})
