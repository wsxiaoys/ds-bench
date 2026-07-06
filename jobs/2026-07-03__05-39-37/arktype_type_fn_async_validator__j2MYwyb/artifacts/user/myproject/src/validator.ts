import { type } from "arktype";

/**
 * Runtime-validated resolved response shape.
 *
 * This `Type` is applied to the value that the simulated network call
 * resolves with, so the runtime resolution is guaranteed to satisfy the
 * declared contract (see hint in the task spec).
 */
export const response = type({
  status: "number.integer >= 100 <= 599",
  body: "string"
});

/**
 * Parameter shape enforced synchronously at the `type.fn` boundary, BEFORE
 * any asynchronous work (i.e. before `setTimeout` is scheduled).
 */
const params = type({
  url: "string.url",
  timeoutMs: "number.integer > 0 <= 10000",
  retries: "number.integer >= 0 <= 5"
});

/**
 * A runtime-validated asynchronous fetch wrapper built with ArkType's
 * `type.fn`.
 *
 * - The parameter shape is validated synchronously by `type.fn` when the
 *   wrapper is invoked. Invalid params throw before any `setTimeout` is
 *   created.
 * - The (Promise) return shape is enforced by `type.fn`'s return type
 *   (`"Promise"`), which asserts the implementation returns a `Promise`
 *   instance.
 * - The resolved value is validated against {@link response} inside the
 *   implementation before the promise resolves.
 *
 * The simulated network call ALWAYS resolves with
 * `{ status: 200, body: "ok" }` after `min(timeoutMs, 50)` milliseconds.
 */
export const fetchWithTimeout = type.fn(params, ":", "Promise")(
  async (p) => {
    const delay = Math.min(p.timeoutMs, 50);
    return await new Promise((resolve) => {
      setTimeout(() => {
        // Validate the resolved value against the declared response Type
        // so the runtime resolution is guaranteed to satisfy the contract.
        resolve(response.assert({ status: 200, body: "ok" }));
      }, delay);
    });
  }
);