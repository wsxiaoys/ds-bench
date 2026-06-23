import { type } from "arktype";

// Define the schema for the resolved response value
export const ResponseType = type({
    status: "100 <= number.integer <= 599",
    body: "string"
});

export type Response = typeof ResponseType.infer;

// Define the validated fetchWithTimeout wrapper using type.fn
export const fetchWithTimeout = type.fn(
    {
        url: "string.url",
        timeoutMs: "0 < number.integer <= 10000",
        retries: "0 <= number.integer <= 5"
    },
    ":",
    "Promise"
)(async (params): Promise<Response> => {
    const delay = Math.min(params.timeoutMs, 50);
    return new Promise<Response>((resolve, reject) => {
        setTimeout(() => {
            try {
                // Ensure the resolved response conforms to ResponseType
                const result = { status: 200, body: "ok" };
                resolve(ResponseType.assert(result));
            } catch (err) {
                reject(err);
            }
        }, delay);
    });
});
