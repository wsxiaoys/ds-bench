// Test script for Convex paginated full-text search
const { ConvexHttpClient } = require("convex/browser");

function parseArgs(argv) {
  const args = { runId: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--run-id" && i + 1 < argv.length) {
      args.runId = argv[i + 1];
      i++;
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.runId) {
    console.error("Usage: node test.js --run-id <run-id>");
    process.exit(1);
  }

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("CONVEX_URL environment variable is not set");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  // 1. Insert 3 messages with the provided runId.
  await client.mutation("messages:insert", {
    body: "Hello world",
    author: "Alice",
    runId: args.runId,
  });
  await client.mutation("messages:insert", {
    body: "Hello Convex",
    author: "Bob",
    runId: args.runId,
  });
  await client.mutation("messages:insert", {
    body: "Hello search",
    author: "Charlie",
    runId: args.runId,
  });

  // 2. Wait for the search index to update by polling/retrying the search query.
  let result = null;
  const maxAttempts = 60;
  const delayMs = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = await client.query("messages:search", {
      query: "Hello",
      runId: args.runId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    if (candidate && Array.isArray(candidate.page) && candidate.page.length > 0) {
      result = candidate;
      break;
    }
    await sleep(delayMs);
  }

  if (!result) {
    // Fall back to one final attempt so we still print something useful.
    result = await client.query("messages:search", {
      query: "Hello",
      runId: args.runId,
      paginationOpts: { numItems: 2, cursor: null },
    });
  }

  // 3. Print the page array from the pagination result as a JSON array.
  const page = (result && result.page) || [];
  console.log(JSON.stringify(page));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});