import { type } from "arktype";

/**
 * Discount schema
 *
 * - percent:       integer in [1, 99] AND divisible by 5 (n % 5 === 0)
 * - amount:        number > 0 AND < 10000 AND at most 2 decimal places
 * - validityDays:  integer in [1, 365]
 * - appliesTo:     one of 'cart', 'shipping', 'item'
 *
 * The numeric range, integer and divisibility constraints are combined via
 * ArkType's string-embedded intersection syntax (e.g. `1 <= ... <= 99` and
 * `% 5`).
 *
 * The decimal-place check on `amount` is implemented via the narrow
 * predicate API (`.narrow(...)`) so it is evaluated as part of validation
 * rather than as a separate regex pre-check.
 */
const Amount = type("0 < number < 10000").narrow((n, ctx) =>
  // at most 2 decimal places (avoid floating point pitfalls via rounding)
  Math.round(n * 100) === n * 100 ? true : ctx.mustBe("at most 2 decimal places")
);

const Discount = type({
  percent: "1 <= number.integer % 5 <= 99",
  amount: Amount,
  validityDays: "1 <= number.integer <= 365",
  appliesTo: "'cart' | 'shipping' | 'item'"
});

export type Discount = typeof Discount.infer;

export interface ValidationResult {
  success: boolean;
  data?: Discount;
  errors?: string;
}

export function validateDiscount(input: unknown): ValidationResult {
  const result = Discount(input);
  if (result instanceof type.errors) {
    return {
      success: false,
      errors: result.summary
    };
  }
  return {
    success: true,
    data: result as Discount
  };
}