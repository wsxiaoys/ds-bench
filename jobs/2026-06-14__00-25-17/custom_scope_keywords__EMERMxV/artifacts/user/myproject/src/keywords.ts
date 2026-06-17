import { scope, type } from "arktype"

function luhnCheck(s: string): boolean {
  let sum = 0
  let alternate = false
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i], 10)
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

const myScope = scope({
  creditCard: type(/^\d{13,19}$/).narrow(luhnCheck),
  usPhone: type(/^\+?1?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}$/),
  slug: type("string")
    .atLeastLength(3)
    .atMostLength(64)
    .matching(/^[a-z0-9-]+$/)
    .narrow((s: string) => !s.startsWith("-") && !s.endsWith("-")),
  Order: {
    id: "slug",
    customerPhone: "usPhone",
    cardNumber: "creditCard",
    total: "number > 0",
  },
})

export const Order = myScope.export().Order