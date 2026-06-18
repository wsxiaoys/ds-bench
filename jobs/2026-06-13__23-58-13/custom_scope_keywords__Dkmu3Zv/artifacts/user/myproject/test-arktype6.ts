import { scope } from "arktype";

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

const myScope = scope({
  creditCard: ["/^\\d{13,19}$/", ":", luhnCheck],
  usPhone: "/^\\+?1?[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{4}$/",
  slug: "/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/ >= 3 <= 64",
  Order: {
    id: "slug",
    customerPhone: "usPhone",
    cardNumber: "creditCard",
    total: "number > 0"
  }
});

const types = myScope.export();
console.log(types.Order({
  id: "my-order",
  customerPhone: "+1 (555) 123-4567",
  cardNumber: "79927398713",
  total: 100.5
}));
