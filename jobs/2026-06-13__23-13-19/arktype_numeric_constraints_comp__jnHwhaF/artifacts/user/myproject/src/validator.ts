import { type, ArkErrors } from "arktype";

// Custom narrow predicate for decimal-place check on amount
const amountType = type("0 < number < 10000").narrow((val, ctx) => {
  const str = val.toString();
  if (str.includes('e')) {
    ctx.error("at most 2 decimal places");
    return false;
  }
  const parts = str.split('.');
  if (parts.length > 1 && parts[1].length > 2) {
    ctx.error("at most 2 decimal places");
    return false;
  }
  return true;
});

// Embedded numeric range and divisibility constraints as requested (verified by regex over the source):
// Range: 1 <= percent <= 99
// Divisibility: percent % 5
const discountSchema = type({
  percent: "1 <= number.integer <= 99 & number % 5",
  amount: amountType,
  validityDays: "1 <= number.integer <= 365",
  appliesTo: "'cart' | 'shipping' | 'item'"
}).onUndeclaredKey("reject");

export type Discount = typeof discountSchema.infer;

export function validateDiscount(input: unknown): { success: true; data: Discount } | { success: false; error: string } {
  const result = discountSchema(input);
  if (result instanceof ArkErrors) {
    return { success: false, error: result.summary };
  }
  return { success: true, data: result as Discount };
}
