import { type } from "arktype";

const responseType = type({
  status: "number.integer >= 100 & number.integer <= 599",
  body: "string"
});

const promiseType = type(["instanceof", Promise]);

const promiseResponse = type.pipe(
  promiseType,
  (promise: any) => {
    return promise.then((resolved: any) => {
      return responseType.assert(resolved);
    });
  }
);

export const fetchWithTimeout = type.fn(
  {
    url: "string.url",
    timeoutMs: "number.integer > 0 & number.integer <= 10000",
    retries: "number.integer >= 0 & number.integer <= 5"
  },
  ":",
  promiseResponse
)((params) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ status: 200, body: "ok" });
    }, Math.min(params.timeoutMs, 50));
  });
});
