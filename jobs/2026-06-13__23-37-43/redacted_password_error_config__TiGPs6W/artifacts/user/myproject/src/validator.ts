import { type } from "arktype"

// ─── Sensitive field types with per-type redaction ───────────────────────────

/**
 * Password type: 12–128 chars, at least one lowercase, uppercase, digit, symbol.
 * Any validation error will show "<redacted>" instead of the raw value.
 */
const passwordType = type("string")
  .atLeastLength(12)
  .atMostLength(128)
  .matching(/[a-z]/)
  .matching(/[A-Z]/)
  .matching(/[0-9]/)
  .matching(/[^a-zA-Z0-9]/)
  .configure({
    actual: () => "<redacted>",
    problem: () => "must be a valid password (was <redacted>)",
  })

/**
 * SSN type: exactly matches NNN-NN-NNNN pattern.
 * Any validation error will show "<redacted>" instead of the raw value.
 */
const ssnType = type(/^\d{3}-\d{2}-\d{4}$/).configure({
  actual: () => "<redacted>",
  problem: () => "must be a valid SSN (was <redacted>)",
})

// ─── Main sign-up schema ─────────────────────────────────────────────────────

export const signUpSchema = type({
  username: "3 <= string <= 20 & /^[a-zA-Z0-9]+$/",
  password: passwordType,
  confirm: passwordType,
  ssn: ssnType,
}).narrow((data, ctx) => {
  if (data.confirm !== data.password) {
    ctx.error({
      expected: "equal to password",
      actual: "<redacted>",
      problem: "must equal password (was <redacted>)",
      path: ["confirm"],
    })
    return false
  }
  return true
})

export type SignUpData = typeof signUpSchema.infer
