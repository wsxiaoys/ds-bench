import { scope, type } from "arktype";

/** Luhn algorithm checksum for credit card validation */
function luhnCheck(value: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = value.length - 1; i >= 0; i--) {
    let n = parseInt(value[i]!, 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * creditCard: 13–19 digit string (no whitespace) that passes the Luhn checksum.
 *
 * - Digit-only + length constraint: expressed via `.matching(...)`.
 * - Luhn checksum: expressed via `.narrow(...)` predicate (satisfies the
 *   "at least one narrow predicate" requirement).
 */
const creditCardType = type("string")
  .matching(/^\d{13,19}$/)
  .narrow(
    (s, ctx) =>
      luhnCheck(s) ||
      ctx.mustBe("a valid credit card number (Luhn check failed)"),
  );

/**
 * usPhone: matches the exact regex pattern from the spec.
 */
const usPhoneType = type("string").matching(
  /^\+?1?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}$/,
);

/**
 * slug: lowercase, 3–64 chars, only [a-z0-9-], no leading or trailing dash.
 *
 * - Character set + length: expressed via `.matching(...)`.
 * - No leading/trailing dash: enforced via `.narrow(...)` predicate.
 */
const slugType = type("string")
  .matching(/^[a-z0-9-]{3,64}$/)
  .narrow(
    (s, ctx) =>
      (s[0] !== "-" && s[s.length - 1] !== "-") ||
      ctx.mustBe("a slug with no leading or trailing dash"),
  );

/**
 * A single scope registering all three custom keywords and the composite
 * Order schema.  Order references them by their bare alias names.
 */
const myScope = scope({
  creditCard: creditCardType,
  usPhone: usPhoneType,
  slug: slugType,

  Order: {
    id: "slug",
    customerPhone: "usPhone",
    cardNumber: "creditCard",
    total: "number > 0",
  },
});

export const { creditCard, usPhone, slug, Order } = myScope.export();
