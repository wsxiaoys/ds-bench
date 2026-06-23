import { scope, type } from "arktype"

/**
 * Luhn algorithm for credit card checksum validation
 */
export function isLuhnValid(val: string): boolean {
  let sum = 0
  let shouldDouble = false
  for (let i = val.length - 1; i >= 0; i--) {
    let digit = parseInt(val.charAt(i), 10)
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
 * Single scope call defining the three custom keywords and the composite Order schema
 */
export const orderScope = scope({
  creditCard: type("13 <= string <= 19 & /^[0-9]+$/").narrow(isLuhnValid),
  usPhone: "string & /^\\+?1?[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{4}$/",
  slug: "3 <= string <= 64 & /^[a-z0-9][a-z0-9-]*[a-z0-9]$/",
  Order: {
    id: "slug",
    customerPhone: "usPhone",
    cardNumber: "creditCard",
    total: "number > 0"
  }
})

export const orderModule = orderScope.export()
export const Order = orderModule.Order
