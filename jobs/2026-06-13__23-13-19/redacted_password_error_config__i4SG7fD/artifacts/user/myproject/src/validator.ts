import { type } from "arktype";

// Password validation helper: length 12-128, at least one lowercase, one uppercase, one digit, and one symbol.
export const isPasswordValid = (s: string): boolean => {
  if (s.length < 12 || s.length > 128) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/\d/.test(s)) return false;
  if (!/[^a-zA-Z0-9]/.test(s)) return false;
  return true;
};

// Define sensitive field types with per-type configuration
export const passwordType = type("string")
  .narrow(isPasswordValid)
  .describe("a password of length 12 through 128 containing at least one lowercase letter, one uppercase letter, one digit, and one symbol")
  .configure({
    actual: () => "<redacted>",
    problem: (ctx) => `must be ${ctx.expected} (was <redacted>)`
  });

export const confirmType = type("string")
  .narrow(isPasswordValid)
  .describe("a password of length 12 through 128 containing at least one lowercase letter, one uppercase letter, one digit, and one symbol")
  .configure({
    actual: () => "<redacted>",
    problem: (ctx) => `must be ${ctx.expected} (was <redacted>)`
  });

export const ssnType = type(/^\d{3}-\d{2}-\d{4}$/)
  .describe("a string matching the pattern ddd-dd-dddd")
  .configure({
    actual: () => "<redacted>",
    problem: (ctx) => `must be ${ctx.expected} (was <redacted>)`
  });

// The main sign-up schema
export const signUpSchema = type({
  username: "string.alphanumeric>=3<=20",
  password: passwordType,
  confirm: confirmType,
  ssn: ssnType
}).narrow((data, ctx) => {
  if (data.password !== data.confirm) {
    ctx.reject({
      expected: "equal to password",
      path: ["confirm"],
      data: data.confirm,
      actual: "<redacted>",
      problem: "must be equal to password (was <redacted>)"
    });
  }
  return true;
});
