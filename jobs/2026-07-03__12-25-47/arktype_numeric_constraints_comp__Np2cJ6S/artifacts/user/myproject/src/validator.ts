import { type } from "arktype";

// Decimal-place check: at most 2 decimal places.
// Implemented using ArkType's narrow predicate API.
const twoDecimalNumber = type("0 < number < 10000").narrow(
    (n, ctx) =>
        Math.round(n * 100) === n * 100 ||
        ctx.mustBe("a number with at most 2 decimal places")
);

export const Discount = type({
    percent: "1 <= (number.integer) <= 99 & (number % 5)",
    amount: twoDecimalNumber,
    validityDays: "1 <= (number.integer) <= 365",
    appliesTo: "'cart' | 'shipping' | 'item'"
});

export type Discount = typeof Discount.infer;

export function validateDiscount(input: unknown) {
    const result = Discount(input);
    if (result instanceof type.errors) {
        return { valid: false, errors: result };
    }
    return { valid: true, data: result };
}
