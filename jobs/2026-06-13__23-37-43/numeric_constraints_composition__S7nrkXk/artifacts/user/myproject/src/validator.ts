import { type } from "arktype";

// percent: integer in [1, 99] AND divisible by 5
// Uses string-embedded range syntax "1 <= number.integer <= 99" intersected
// with "number % 5" divisibility — both expressed as ArkType string syntax.
const percentType = type("1 <= number.integer <= 99 % 5");

// amount: number strictly > 0 and strictly < 10000, with at most 2 decimal places.
// Range constraints are embedded in the string; the decimal-place check is a
// custom narrow predicate (NOT a pre-check regex — it runs inside ArkType).
const amountType = type("0 < number < 10000").narrow(
  (n, ctx) =>
    Number.isFinite(Math.round(n * 100) / 100 - n)
      ? (n * 100) % 1 === 0 ||
        ctx.mustBe("a number with at most 2 decimal places")
      : ctx.mustBe("a finite number"),
);

// validityDays: integer in [1, 365]
const validityDaysType = type("1 <= number.integer <= 365");

// appliesTo: string union literal
const appliesToType = type("'cart' | 'shipping' | 'item'");

// The complete Discount object schema
export const DiscountSchema = type({
  percent: percentType,
  amount: amountType,
  validityDays: validityDaysType,
  appliesTo: appliesToType,
});

export type Discount = typeof DiscountSchema.infer;

/**
 * Validate an unknown input against the Discount schema.
 * Returns { ok: true, data } on success, or { ok: false, summary } on failure.
 */
export function validateDiscount(input: unknown):
  | { ok: true; data: Discount }
  | { ok: false; summary: string } {
  const result = DiscountSchema(input);
  if (result instanceof type.errors) {
    return { ok: false, summary: result.summary };
  }
  return { ok: true, data: result };
}
