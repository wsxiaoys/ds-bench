import { type } from "arktype";

// Amount: number strictly greater than 0 AND strictly less than 10000
// (exclusive bounds on both sides) AND with at most 2 decimal places.
// We use ArkType's narrow predicate API for the decimal-places check.
const Amount = type("0 < number < 10000").narrow(
  (n, ctx) =>
    Math.round(n * 100) === n * 100 ||
    ctx.mustBe("a number with at most 2 decimal places")
);

export const Discount = type({
  // percent: integer in [1, 99] AND divisible by 5.
  // The numeric range, integer and divisibility constraints are combined
  // using ArkType's string-embedded intersection syntax.
  percent: "1 <= number%1 <= 99 & number%5",
  // amount: number > 0 AND < 10000 AND at most 2 decimal places (via narrow)
  amount: Amount,
  // validityDays: integer in [1, 365]
  validityDays: "1 <= number%1 <= 365",
  // appliesTo: literal union
  appliesTo: "'cart' | 'shipping' | 'item'"
});

export type Discount = typeof Discount.infer;

export function validateDiscount(input: unknown): Discount | { errors: string } {
  const out = Discount(input);
  if (out instanceof type.errors) {
    return { errors: out.summary };
  }
  return out as Discount;
}

export default Discount;
