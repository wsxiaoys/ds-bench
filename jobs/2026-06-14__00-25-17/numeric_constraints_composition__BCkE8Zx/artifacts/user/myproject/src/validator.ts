import { type } from "arktype";

const Amount = type("0 < number < 10000").narrow((n) => {
  const str = n.toString();
  const idx = str.indexOf(".");
  if (idx === -1) return true;
  return str.length - idx - 1 <= 2;
});

export const Discount = type({
  percent: "number.integer & 1 <= number <= 99 & number % 5",
  amount: Amount,
  validityDays: "number.integer & 1 <= number <= 365",
  appliesTo: "'cart' | 'shipping' | 'item'",
});

export function validateDiscount(input: unknown) {
  const result = Discount(input);
  if (result instanceof type.errors) {
    return { valid: false as const, error: result.summary };
  }
  return { valid: true as const, data: result };
}