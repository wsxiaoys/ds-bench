import { type } from "arktype";

const response = type({
  status: "number.integer >= 100 <= 599",
  body: "string"
});

const params = type({
  url: "string.url",
  timeoutMs: "number.integer > 0 <= 10000",
  retries: "number.integer >= 0 <= 5"
});

const fetchWithTimeout = type.fn(params, ":", "Promise")(
  async (p) => {
    const delay = Math.min(p.timeoutMs, 50);
    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve(response.assert({ status: 200, body: "ok" }));
      }, delay);
    });
  }
);

async function main() {
  // valid
  try {
    const r = await fetchWithTimeout({ url: "https://example.com", timeoutMs: 100, retries: 2 });
    console.log("VALID:", JSON.stringify(r));
  } catch (e) {
    console.log("VALID ERR:", (e as Error).message);
  }

  // invalid timeout (0)
  try {
    const r = await fetchWithTimeout({ url: "https://example.com", timeoutMs: 0, retries: 2 });
    console.log("INVALID0:", JSON.stringify(r));
  } catch (e) {
    console.log("INVALID0 ERR:", (e as Error).message);
  }

  // invalid retries (6)
  try {
    await fetchWithTimeout({ url: "https://example.com", timeoutMs: 100, retries: 6 });
    console.log("INVALID6: no throw");
  } catch (e) {
    console.log("INVALID6 ERR:", (e as Error).message);
  }

  // invalid url
  try {
    await fetchWithTimeout({ url: "not a url", timeoutMs: 100, retries: 2 } as never);
    console.log("INVALIDURL: no throw");
  } catch (e) {
    console.log("INVALIDURL ERR:", (e as Error).message);
  }

  // missing field
  try {
    await fetchWithTimeout({ url: "https://example.com", timeoutMs: 100 } as never);
    console.log("MISSING: no throw");
  } catch (e) {
    console.log("MISSING ERR:", (e as Error).message);
  }
}

main();