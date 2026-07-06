import { type } from "arktype";

/**
 * A `Discount` object validated using arktype@2.2.0.
 *
 * Field constraints:
 * - `percent`:      an integer in the inclusive range [1, 99] AND divisible by 5.
 * - `amount`:       a number strictly greater than 0 AND strictly less than 10000
 *                    AND with at most 2 decimal places (checked via `.narrow(...)`).
 * - `validityDays`: an integer in the inclusive range [1, 365].
 * - `appliesTo`:    one of the string literals 'cart', 'shipping', or 'item'.
 *
 * The numeric range, divisibility, and integer constraints for `percent` and
 * `validityDays` are combined via ArkType's string-embedded intersection syntax.
 * The decimal-place check on `amount` is implemented using ArkType's narrow
 * predicate API (`.narrow(...)`).
 */
export const Discount = type({
	percent: "1 <= number.integer <= 99 % 5",
	amount: type("0 < number < 10000").narrow((n: number) => {
		// At most 2 decimal places, e.g. 99.99 is allowed, 1.234 is not.
		const str = n.toString();
		const dotIndex = str.indexOf(".");
		if (dotIndex === -1) return true;
		return str.length - dotIndex - 1 <= 2;
	}),
	validityDays: "1 <= number.integer <= 365",
	appliesTo: "'cart' | 'shipping' | 'item'"
});

export type Discount = typeof Discount.infer;

/**
 * Validate an unknown input against the `Discount` schema.
 *
 * @returns the validated `Discount` object if the input is valid.
 * @throws   an `ArkErrors`-like object (returned by arktype) if invalid —
 *           callers can inspect `.summary` for a human-readable description.
 */
export function validateDiscount(input: unknown): Discount {
	return Discount.assert(input);
}