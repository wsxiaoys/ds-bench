import { type } from "arktype";

// 1. Password Type: string of length 12 through 128 inclusive,
// containing at least one lowercase letter, one uppercase letter, one digit, and one symbol.
export const passwordType = type("12 <= string <= 128 & /[a-z]/ & /[A-Z]/ & /\\d/ & /[^\\dA-Za-z]/")
    .configure({
        actual: "<redacted>",
        problem: (ctx) => `must be a valid password (was <redacted>)`,
        message: (ctx) => `must be a valid password (was <redacted>)`
    });

// 2. Confirm Type: must satisfy the same password constraints AND be equal to the supplied password value.
export const confirmType = type("12 <= string <= 128 & /[a-z]/ & /[A-Z]/ & /\\d/ & /[^\\dA-Za-z]/")
    .narrow((val, ctx) => {
        const password = (ctx.root as any)?.password;
        if (val !== password) {
            return ctx.reject({
                expected: "equal to password",
                actual: "<redacted>"
            });
        }
        return true;
    })
    .configure({
        actual: "<redacted>",
        problem: (ctx) => `must be equal to password (was <redacted>)`,
        message: (ctx) => `confirm must be equal to password (was <redacted>)`
    });

// 3. SSN Type: string matching ^\d{3}-\d{2}-\d{4}$
export const ssnType = type("/^\\d{3}-\\d{2}-\\d{4}$/")
    .configure({
        actual: "<redacted>",
        problem: (ctx) => `must be a valid SSN (was <redacted>)`,
        message: (ctx) => `must be a valid SSN (was <redacted>)`
    });

// 4. Signup Schema
export const signupSchema = type({
    username: "3 <= string.alphanumeric <= 20",
    password: passwordType,
    confirm: confirmType,
    ssn: ssnType
});
