import { type } from "arktype";

/**
 * Arktype `Type` describing the resolved value of `fetchWithTimeout`.
 *
 * The wrapper always resolves with `{ status: 200, body: "ok" }`, but we still
 * declare (and use) this `Type` so that the runtime resolution is guaranteed
 * to satisfy the declared contract.
 */
export const responseType = type({
  status: "100 <= number.integer <= 599",
  body: "string"
});

/**
 * Parameter schema enforced synchronously by `type.fn` BEFORE the
 * implementation body is even invoked.
 */
const paramsType = {
  url: "string.url",
  timeoutMs: "0 < number.integer <= 10000",
  retries: "0 <= number.integer <= 5"
} as const;

/**
 * Validated async fetch wrapper.
 *
 * - The parameter shape and the `Promise` return shape are enforced by
 *   `type.fn` at the call boundary.
 * - The resolved value is validated by the `responseType` arktype `Type`
 *   inside the implementation body so that any deviation from the declared
 *   contract surfaces as a rejected promise.
 *
 * Calling `fetchWithTimeout` with an invalid argument throws synchronously,
 * before any `setTimeout` is scheduled.
 */
export const fetchWithTimeout = type.fn(
  paramsType,
  ":",
  type.instanceOf(Promise)
)(async ({ timeoutMs }) => {
  const delayMs = Math.min(timeoutMs, 50);

  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    setTimeout(() => {
      // Validate the resolved value against the declared `responseType`.
      // `responseType(...)` returns either the validated data or an
      // `ArkErrors` instance; we surface the failure as a rejection so the
      // wrapper never resolves with a value that violates the contract.
      const validated = responseType({ status: 200, body: "ok" });
      if (validated instanceof type.errors) {
        reject(validated);
        return;
      }
      resolve(validated);
    }, delayMs);
  });
});

export type FetchWithTimeoutParams = {
  url: string;
  timeoutMs: number;
  retries: number;
};

export type FetchWithTimeoutResponse = {
  status: number;
  body: string;
};