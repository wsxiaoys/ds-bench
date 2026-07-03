import { type } from "arktype";

// Combine integer, numeric range, and divisibility constraints via
// ArkType's string-embedded intersection syntax. This validates that
// percent is an integer in [1, 99] divisible by 5.
const percentType = type("1 <= number.integer <= 99 & (number % 5)");

// Numeric range for amount: strictly greater than 0, strictly less than 10000.
// The at-most-2-decimal-places check is enforced via ArkType's narrow
// predicate API (no separate regex pre-check is performed before validation).
const amountType = type("0 < number < 10000").narrow((n, ctx) => {
	if (Number.isFinite(n) && Number.isInteger(n * 100)) return true;
	return ctx.mustBe("at most 2 decimal places");
});

const validityDaysType = type("1 <= number <= 365");

const appliesToType = type.enumerated("cart", "shipping", "item");

export const Discount = type({
	percent: percentType,
	amount: amountType,
	validityDays: validityDaysType,
	appliesTo: appliesToType,
});

export type Discount = typeof Discount.infer;

export type ValidationResult =
	| { valid: true; data: Discount }
	| { valid: false; error: string };

/**
 * Validate an unknown input as a Discount object.
 *
 * Returns a discriminated union: on success `{ valid: true, data }`,
 * on failure `{ valid: false, error }` where `error` is a human-readable summary.
 */
export function validateDiscount(input: unknown): ValidationResult {
	const result = Discount(input);
	if (result instanceof type.errors) {
		return { valid: false, error: result.summary };
	}
	return { valid: true, data: result as Discount };
}
