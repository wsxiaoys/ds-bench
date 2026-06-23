import { attest } from "@arktype/attest"
import { type } from "arktype"
import { test } from "vitest"
import { parsedInt, user, event, role } from "../src/schemas.js"

test("schemas", () => {
    // 1. pure compile-time type-equality check
    attest<"admin" | "user" | "guest">(role.infer)

    // 2. .type.toString.snap(...)
    attest(role.infer).type.toString.snap()

    // 3. runtime .throws(...) check
    attest(() => role.assert("invalid")).throws("must be \"admin\", \"guest\" or \"user\" (was \"invalid\")")

    // 4. .throwsAndHasTypeError(...) check guarded by // @ts-expect-error
    // @ts-expect-error
    attest(() => type("invalid_type")).throwsAndHasTypeError("invalid_type")

    // 5. .completions({...}) check guarded by // @ts-expect-error
    // @ts-expect-error
    attest(() => type("'ad")).completions({ "'ad": ["'ad requires a closing single-quote\u200B"] })

    // 6. Another attest
    attest<number>(parsedInt.infer)

    // 7. Another attest
    attest(event.infer).type.toString.snap()

    // 8. Another attest
    attest(() => parsedInt.assert("abc")).throws("must be a well-formed numeric string (was \"abc\")")
})
