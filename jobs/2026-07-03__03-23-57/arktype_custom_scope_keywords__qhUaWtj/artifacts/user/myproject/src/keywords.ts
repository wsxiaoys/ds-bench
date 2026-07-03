import { scope, type } from "arktype"

/**
 * Validates if a string of digits passes the Luhn checksum.
 */
export function luhnCheck(cardNumber: string): boolean {
  let sum = 0
  let shouldDouble = false
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i), 10)

    if (shouldDouble) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    shouldDouble = !shouldDouble
  }

  return sum % 10 === 0
}

/**
 * ArkType scope containing custom keywords and the composite Order schema.
 */
export const orderScope = scope({
  creditCard: type("13 <= string <= 19 & /^[0-9]+$/").narrow(function luhn(s) { return luhnCheck(s) }),
  usPhone: "string & /^\\+?1?[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{4}$/",
  slug: "3 <= string <= 64 & /^[a-z0-9][a-z0-9-]*[a-z0-9]$/",
  Order: {
    id: "slug",
    customerPhone: "usPhone",
    cardNumber: "creditCard",
    total: "number > 0"
  }
})

// Export the Order schema directly for ease of use
export const Order = orderScope.export().Order
