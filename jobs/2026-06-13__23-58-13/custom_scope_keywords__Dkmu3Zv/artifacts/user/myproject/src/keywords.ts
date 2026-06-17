import { scope, type } from "arktype";

function luhnCheck(num: string) {
    let sum = 0;
    let shouldDouble = false;
    for (let i = num.length - 1; i >= 0; i--) {
        let digit = parseInt(num.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

export const myScope = scope({
  creditCard: type("/^\\d{13,19}$/").narrow(luhnCheck),
  usPhone: "/^\\+?1?[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{4}$/",
  slug: "/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/ >= 3 <= 64",
  Order: {
    id: "slug",
    customerPhone: "usPhone",
    cardNumber: "creditCard",
    total: "number > 0"
  }
});

export const types = myScope.export();
export const Order = types.Order;
