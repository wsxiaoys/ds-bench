import { type, ArkErrors } from "arktype"

/**
 * ArkType schema for a `Discount` object.
 *
 * Fields:
 *  - percent:      an integer in the inclusive range [1, 99] AND divisible by 5.
 *  - amount:       a number strictly greater than 0 AND strictly less than 10000
 *                  AND with at most 2 decimal places (enforced via `.narrow()`).
 *  - validityDays:  an integer in the inclusive range [1, 365].
 *  - appliesTo:    one of the string literals 'cart', 'shipping', or 'item'.
 *
 * The numeric range, divisibility, and integer constraints for `percent` are
 * combined via ArkType's string-embedded intersection syntax:
 *
 *     "1 <= number.integer <= 99 % 5"
 *
 * which embeds both a numeric range expression (`1 <= ... <= 99`) and a
 * `% 5` divisibility constraint.
 */
const amountType = type("0 < number < 10000").narrow((n: number) => {
  // Check that the number has at most 2 decimal places.
  const str = String(n)
  const dotIndex = str.indexOf(".")
  const decimals = dotIndex === -1 ? 0 : str.length - dotIndex - 1
  return decimals <= 2
})

export const DiscountSchema = type({
  percent: "1 <= number.integer <= 99 % 5",
  amount: amountType,
  validityDays: "1 <= number.integer <= 365",
  appliesTo: "'cart' | 'shipping' | 'item'"
})

export type Discount = typeof DiscountSchema.infer

export type DiscountValidationResult =
  | { valid: true; data: Discount }
  | { valid: false; error: string }

/**
 * Validate an unknown input against the `Discount` schema.
 *
 * @param input - The raw (e.g. JSON-parsed) value to validate.
 * @returns A discriminated union indicating success (`valid: true` with
 *          validated `data`) or failure (`valid: false` with an `error`
 *          description string).
 */
export function validateDiscount(input: unknown): DiscountValidationResult {
  const result = DiscountSchema(input)

  if (result instanceof ArkErrors) {
    return { valid: false, error: result.summary }
  }

  return { valid: true, data: result }
}