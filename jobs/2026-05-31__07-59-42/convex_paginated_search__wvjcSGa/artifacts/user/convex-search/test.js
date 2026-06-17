const { ConvexHttpClient } = require("convex/browser");
const { api } = require("./convex/_generated/api");

async function main() {
  const args = process.argv.slice(2);
  let runId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-id" && i + 1 < args.length) {
      runId = args[i + 1];
      break;
    }
  }
  if (!runId) {
    console.error("Missing --run-id argument");
    process.exit(1);
  }

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Missing CONVEX_URL environment variable");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  // Insert 3 messages
  await client.mutation(api.messages.insert, {
    body: "Hello world",
    author: "Alice",
    channelId: runId,
  });
  await client.mutation(api.messages.insert, {
    body: "Hello Convex",
    author: "Bob",
    channelId: runId,
  });
  await client.mutation(api.messages.insert, {
    body: "Hello search",
    author: "Charlie",
    channelId: runId,
  });

  // Poll for search results (search indexing is asynchronous)
  const maxRetries = 30;
  const retryDelay = 1000;
  let results = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    results = await client.query(api.messages.search, {
      query: "Hello",
      channelId: runId,
      paginationOpts: { numItems: 2, cursor: null },
    });

    if (results.page && results.page.length > 0) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  // Print the page array as JSON
  console.log(JSON.stringify(results.page));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});