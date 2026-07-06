import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("CONVEX_URL environment variable is required");
  process.exit(1);
}

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-id" && i + 1 < args.length) {
      result.runId = args[i + 1];
      i++;
    }
  }
  return result;
}

const { runId } = parseArgs(process.argv.slice(2));

if (!runId) {
  console.error("--run-id <run-id> argument is required");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const messages = [
  { body: "Hello world", author: "Alice" },
  { body: "Hello Convex", author: "Bob" },
  { body: "Hello search", author: "Charlie" },
];

for (const msg of messages) {
  await client.mutation(api.messages.insert, {
    body: msg.body,
    author: msg.author,
    runId,
  });
}

const PAGE_SIZE = 2;
const MAX_RETRIES = 20;
const RETRY_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let page = [];
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const result = await client.query(api.messages.search, {
    query: "Hello",
    runId,
    paginationOpts: { numItems: PAGE_SIZE, cursor: null },
  });
  if (result.page && result.page.length > 0) {
    page = result.page;
    break;
  }
  await sleep(RETRY_DELAY_MS);
}

console.log(JSON.stringify(page));