import { type } from "arktype";

const Params = type({
  url: "string.url",
  timeoutMs: "1 <= number.integer <= 10000",
  retries: "0 <= number.integer <= 5"
});

const ResponseType = type({
  status: "100 <= number.integer <= 599",
  body: "string"
});

const ValidatedPromise = type("Promise").pipe((p) => p.then(v => ResponseType.assert(v)));

export const fetchWithTimeout = type.fn(Params, ":", ValidatedPromise)(async (params) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ status: 200, body: "ok" });
    }, Math.min(params.timeoutMs, 50));
  });
});
