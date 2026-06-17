import { type } from "arktype";

export const discountSchema = type({
    percent: "(1 <= number <= 99) & (number % 5) & (number % 1)",
    amount: type("0 < number < 10000").narrow((n, ctx) => {
        if (Math.round(n * 100) / 100 !== n) {
            return ctx.mustBe("at most 2 decimal places");
        }
        return true;
    }),
    validityDays: "(1 <= number <= 365) & (number % 1)",
    appliesTo: "'cart' | 'shipping' | 'item'"
});

export function validateDiscount(input: unknown) {
    return discountSchema(input);
}
