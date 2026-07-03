import { scope, type } from "arktype";

// Luhn checksum implementation for credit card validation.
// Assumes input is a string of digits.
export const isLuhnValid = (s: string): boolean => {
    let sum = 0;
    let shouldDouble = false;
    for (let i = s.length - 1; i >= 0; i--) {
        let digit = s.charCodeAt(i) - 48;
        if (shouldDouble) {
            digit *= 2;
            sum += digit >= 10 ? digit - 9 : digit;
        } else {
            sum += digit;
        }
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
};

export const keywordsScope = scope({
    creditCard: type("string.digits")
        .atLeastLength(13)
        .atMostLength(19)
        .narrow(isLuhnValid),
    usPhone: type("string").matching(
        "^\\+?1?[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{4}$"
    ),
    slug: type("string")
        .matching("^[a-z0-9]+(?:[-][a-z0-9]+)*$")
        .atLeastLength(3)
        .atMostLength(64),
    Order: {
        id: "slug",
        customerPhone: "usPhone",
        cardNumber: "creditCard",
        total: "number > 0"
    }
}).export();

export const Order = keywordsScope.Order;
