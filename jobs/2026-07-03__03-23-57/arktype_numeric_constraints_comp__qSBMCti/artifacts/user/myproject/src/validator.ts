import { type } from "arktype";

// Define the amount validator using ArkType's narrow predicate API
const amountType = type("0 < number < 10000").narrow((val, ctx) => {
    const str = val.toString();
    if (str.includes("e") || str.includes("E")) {
        ctx.error("must have at most 2 decimal places");
        return false;
    }
    const parts = str.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
        ctx.error("must have at most 2 decimal places");
        return false;
    }
    return true;
});

// Define the Discount schema combining numeric range, divisibility, and integer constraints
export const discountType = type({
    percent: "1 <= number.integer <= 99 & number % 5",
    amount: amountType,
    validityDays: "1 <= number.integer <= 365",
    appliesTo: "'cart' | 'shipping' | 'item'"
});

// Export the validateDiscount function
export function validateDiscount(input: unknown) {
    return discountType(input);
}
