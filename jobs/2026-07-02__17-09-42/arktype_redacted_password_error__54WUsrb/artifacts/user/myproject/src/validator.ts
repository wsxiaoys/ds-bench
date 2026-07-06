import { type, type Type } from "arktype";

/**
 * Sensitive field names whose raw values must never appear in serialized errors.
 */
const SENSITIVE_FIELDS = new Set(["password", "confirm", "ssn"]);

/**
 * Literal token used in place of the raw sensitive value in any error text
 * or echoed field.
 */
const REDACTED = "<redacted>";

/**
 * Per-type configuration applied to the password schema.
 *
 * Uses both length constraints (`"12 <= string <= 128"`) and a narrowing
 * predicate that enforces the four complexity rules (lowercase, uppercase,
 * digit, symbol).  The `.configure({ actual, problem, ... })` call is the
 * per-type error configuration that causes every error attributable to this
 * type to be rendered with `<redacted>` instead of the raw input.
 */
const passwordType: Type<string, {}> = type("12 <= string <= 128")
  .narrow((s): s is string => {
    const value = s as string;
    return (
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      /[^a-zA-Z0-9]/.test(value)
    );
  })
  .configure({
    actual: () => REDACTED,
    problem: () => `password must be <redacted> (was ${REDACTED})`,
    expected: () => "a password 12-128 chars with upper, lower, digit, and symbol",
  });

/**
 * Per-type configuration applied to the confirm schema.  It carries the same
 * complexity rules as the password, and equality with `password` is enforced
 * on the parent schema so that the equality error does not leak the raw
 * confirm value.
 */
const confirmType: Type<string, {}> = type("12 <= string <= 128")
  .narrow((s): s is string => {
    const value = s as string;
    return (
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      /[^a-zA-Z0-9]/.test(value)
    );
  })
  .configure({
    actual: () => REDACTED,
    problem: () => "confirm does not satisfy complexity/length requirements",
    expected: () => "a confirm value 12-128 chars with upper, lower, digit, and symbol",
  });

/**
 * Per-type configuration applied to the SSN schema.  The pattern is enforced
 * with a regex constraint and the per-type configuration redacts the raw
 * value in error output.
 */
const ssnType: Type<string, {}> = type(/^\d{3}-\d{2}-\d{4}$/).configure({
  actual: () => REDACTED,
  problem: () => "ssn must match the format ###-##-####",
  expected: () => "a string matching ^\\d{3}-\\d{2}-\\d{4}$",
});

/**
 * Sign-up object schema.
 *
 * The `username` field is intentionally not redacted.
 *
 * The `.narrow(...)` on the parent object enforces that `password` and
 * `confirm` are equal.  Because the predicate returns a plain boolean
 * (instead of calling `ctx.mustBe(...)`), the meta configured on the parent
 * is used to render the error, which means the equality mismatch error is
 * emitted with the redacted `actual` and `problem` text.
 */
export const Signup: Type<
  {
    username: string;
    password: string;
    confirm: string;
    ssn: string;
  },
  {}
> = type({
  username: "3 <= string <= 20",
  password: passwordType,
  confirm: confirmType,
  ssn: ssnType,
}).narrow(
  (data): data is {
    username: string;
    password: string;
    confirm: string;
    ssn: string;
  } => data.password === data.confirm,
).configure({
  actual: () => REDACTED,
  problem: () => "password and confirm must match",
});

/**
 * Walk an error and redact the `data` field for any sensitive path so that
 * the raw value is not echoed in the serialized error output.
 */
function redactErrorData(error: any): void {
  const segments: PropertyKey[] = Array.isArray(error.path)
    ? [...error.path]
    : [];
  const head = segments[0];
  if (typeof head === "string" && SENSITIVE_FIELDS.has(head)) {
    error.data = REDACTED;
    return;
  }
  if (segments.length === 0 && error.data && typeof error.data === "object") {
    for (const key of SENSITIVE_FIELDS) {
      if (key in error.data) {
        error.data[key] = REDACTED;
      }
    }
  }
}

/**
 * Sanitize ArkErrors so that the raw value of any sensitive field never
 * appears in the serialized representation.  The per-type configuration
 * already redacts the textual `actual` / `problem` / `message` fields; this
 * function additionally redacts the structural `data` field for sensitive
 * paths.
 */
export function redactErrors(errors: any): any {
  if (!errors) return errors;
  for (const e of errors) {
    redactErrorData(e);
  }
  return errors;
}
