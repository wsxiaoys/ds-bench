import { scope } from "arktype";

// Luhn checksum validation
const isLuhnValid = (input: string): boolean => {
  // Input must be 13-19 digits (no whitespace)
  if (!/^\d{13,19}$/.test(input)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = input.length - 1; i >= 0; i--) {
    let digit = parseInt(input.charAt(i), 10);
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

// Slug validation: lowercase, 3-64 chars, a-z/0-9/-, no leading/trailing dash
const isSlugValid = (input: string): boolean => {
  return input.length >= 3 && input.length <= 64 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input);
};

const $ = scope({
  // creditCard: 13-19 digits passing Luhn checksum
  creditCard: [
    "string",
    ":",
    (s: string) => isLuhnValid(s),
  ],

  // usPhone: matches the specified regex pattern
  usPhone: /^\+?1?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}$/,

  // slug: lowercase, 3-64 chars, a-z/0-9/-, no leading/trailing dash
  slug: [
    "string",
    ":",
    (s: string) => isSlugValid(s),
  ],

  // Order: composite schema referencing custom keywords by bare name
  Order: {
    id: "slug",
    customerPhone: "usPhone",
    cardNumber: "creditCard",
    total: "number > 0",
  },
});

export const Order = $.Order;
export default $;
