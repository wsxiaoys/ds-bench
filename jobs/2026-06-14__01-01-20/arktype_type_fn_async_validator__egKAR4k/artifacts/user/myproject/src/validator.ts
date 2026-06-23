import { fn, type } from "arktype";

// Define the response shape type using ArkType
const responseType = type({
  status: "100 <= number % 1 <= 599",
  body: "string",
});

// Define fetchWithTimeout using ArkType's type.fn
// Parameters: url (URL string), timeoutMs (integer 1..10000), retries (integer 0..5)
// Return: Promise of { status: integer 100..599, body: string }
export const fetchWithTimeout = fn(
  {
    url: "string.url",
    timeoutMs: "1 <= number % 1 <= 10000",
    retries: "0 <= number % 1 <= 5",
  },
  ":",
  responseType,
)(async (params) => {
  // Simulate a network call with setTimeout
  // Always resolve after min(timeoutMs, 50) milliseconds
  const delay = Math.min(params.timeoutMs, 50);
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  return { status: 200, body: "ok" };
});
