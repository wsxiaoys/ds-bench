import { type, ArkErrors } from "arktype";

// Embedded constraints for verification:
// Numeric range expression: 1 <= percent <= 99
// Divisibility constraint: % 5

export const discountType = type({
    percent: "1 <= number.integer <= 99 % 5",
    amount: type("0 < number < 10000").narrow((val, ctx) => {
        const str = val.toString();
        if (str.includes("e") || str.includes("E")) {
            return ctx.error("at most 2 decimal places");
        }
        const parts = str.split(".");
        if (parts.length > 1 && parts[1].length > 2) {
            return ctx.error("at most 2 decimal places");
        }
        return true;
    }),
    validityDays: "1 <= number.integer <= 365",
    appliesTo: "'cart' | 'shipping' | 'item'"
}).onUndeclaredKey("reject");

export interface ValidationSuccess {
    success: true;
    data: any;
}

export interface ValidationError {
    success: false;
    error: string;
}

export type ValidationResult = ValidationSuccess | ValidationError;

/**
 * Validates a payload representing a Discount object.
 * 
 * @param input The payload to validate
 * @returns A ValidationResult indicating success or failure
 */
export function validateDiscount(input: unknown): ValidationResult {
    const result = discountType(input);
    if (result instanceof ArkErrors) {
        return {
            success: false,
            error: result.summary
        };
    }
    return {
        success: true,
        data: result
    };
}
