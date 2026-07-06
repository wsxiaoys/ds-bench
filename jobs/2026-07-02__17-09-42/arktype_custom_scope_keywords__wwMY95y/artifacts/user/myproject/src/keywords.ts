import { scope } from "arktype";

/**
 * Narrow predicate implementing the Luhn (mod-10) checksum for a string of
 * decimal digits. The caller is responsible for ensuring the input is already
 * a digit-only string (enforced structurally via the `creditCard` definition).
 */
const isLuhnValid = (s: string): boolean => {
	let sum = 0;
	let shouldDouble = false;
	for (let i = s.length - 1; i >= 0; i--) {
		let d = parseInt(s.charAt(i), 10);
		if (shouldDouble) {
			d *= 2;
			sum += d >= 10 ? (d % 10) + 1 : d;
		} else {
			sum += d;
		}
		shouldDouble = !shouldDouble;
	}
	return sum % 10 === 0;
};

/**
 * Single ArkType scope exposing the three custom domain keywords (`creditCard`,
 * `usPhone`, `slug`) alongside the composite `Order` schema that references
 * them by their bare alias name.
 */
export const orderScope = scope({
	// 13-19 digits (no whitespace) and a valid Luhn checksum.
	// Digit count is enforced structurally with a regex; the checksum lives
	// in user code as a narrow predicate.
	creditCard: ["/^\\d{13,19}$/", ":", isLuhnValid],

	// US phone numbers matching the specified pattern exactly.
	usPhone: "/^\\+?1?[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{4}$/",

	// Lowercase slug: 3-64 characters, drawn from [a-z0-9-], with no leading
	// or trailing dash. Character set + dash rule via regex; length bounds via
	// structural string constraints intersected as separate comparisons.
	slug: [
		"/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/",
		"&",
		["string >= 3", "&", "string <= 64"],
	],

	// Composite schema referencing the keywords by their bare alias name.
	Order: {
		id: "slug",
		customerPhone: "usPhone",
		cardNumber: "creditCard",
		total: "number > 0",
	},
});

/**
 * The resolved Module exposes each definition as a callable Type. We export
 * both the underlying scope and the resolved types for callers that prefer
 * one or the other.
 */
export const schemas = orderScope.export();

export const Order = schemas.Order;
export const creditCard = schemas.creditCard;
export const usPhone = schemas.usPhone;
export const slug = schemas.slug;

export default orderScope;