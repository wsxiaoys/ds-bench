import { type, fn } from "arktype";

// ---------------------------------------------------------------------------
// Validated response shape
// ---------------------------------------------------------------------------
const responseType = type({
  status: "number.integer >= 100 & number.integer <= 599",
  body: "string",
});

type ValidatedResponse = typeof responseType.infer;

// ---------------------------------------------------------------------------
// fetchWithTimeout – validated async wrapper via type.fn
//
// type.fn validates:
//   • Parameters synchronously before the implementation body runs.
//   • Return value synchronously after the implementation returns (the
//     Promise object itself is checked – it is a Promise instance).
//
// Resolved-value validation is handled INSIDE the implementation so that
// the final resolved shape is guaranteed to match the declared contract.
// ---------------------------------------------------------------------------
export const fetchWithTimeout = fn(
  // Parameter tuple definition
  {
    url: "string.url",
    timeoutMs: "number.integer > 0 & number.integer <= 10000",
    retries: "number.integer >= 0 & number.integer <= 5",
  },
  // Return-type separator + return type definition
  ":",
  "Promise",
)(
  // Implementation – parameter validation has already happened at this point.
  async (params): Promise<ValidatedResponse> => {
    const delay = Math.min(params.timeoutMs, 50);

    const raw = await new Promise<unknown>((resolve) => {
      setTimeout(() => {
        resolve({ status: 200, body: "ok" });
      }, delay);
    });

    // Validate the resolved value against the declared response shape.
    const result = responseType(raw);
    if (result instanceof type.errors) {
      throw new Error(`Invalid response shape: ${result.summary}`);
    }
    return result;
  },
);
