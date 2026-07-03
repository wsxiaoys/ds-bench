import { scope } from "arktype"

/**
 * Luhn checksum validation.
 *
 * Implemented as a plain predicate so it can be attached to `creditCard` via a
 * narrow (`:`) constraint. The structural digit-count rule is expressed as a
 * regex literal; only the checksum lives in user code.
 */
const luhnIsValid = (cardNumber: string): boolean => {
	let sum = 0
	let shouldDouble = false

	// Walk the digits from right to left, doubling every second digit.
	for (let i = cardNumber.length - 1; i >= 0; i--) {
		const digit = cardNumber.charCodeAt(i) - 48

		if (shouldDouble) {
			const doubled = digit * 2
			sum += doubled > 9 ? doubled - 9 : doubled
		} else {
			sum += digit
		}

		shouldDouble = !shouldDouble
	}

	return sum % 10 === 0
}

/**
 * A single ArkType scope that owns all three custom keywords plus the composite
 * `Order` schema. The keywords are referenced by their bare alias names from the
 * `Order` definition rather than being stitched together afterwards.
 */
export const OrderScope = scope({
	// 13 to 19 digits, no whitespace, passing the Luhn checksum.
	creditCard: ["/^[0-9]{13,19}$/", ":", luhnIsValid],

	// US phone number, matching the exact required regular expression.
	usPhone: "/^\\+?1?[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{4}$/",

	// Lowercase slug of length 3-64 over [a-z0-9-] with no leading/trailing dash.
	slug: [
		"/^[a-z0-9-]{3,64}$/",
		":",
		(s: string) => s[0] !== "-" && s[s.length - 1] !== "-"
	],

	// Composite schema referencing the custom keywords by bare name.
	Order: {
		id: "slug",
		customerPhone: "usPhone",
		cardNumber: "creditCard",
		total: "number > 0"
	}
})

/** The composite `Order` type, resolved from {@link OrderScope}. */
export const Order = OrderScope.resolve("Order")

export type OrderType = typeof Order.t