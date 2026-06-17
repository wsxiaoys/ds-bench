const { ConvexHttpClient } = require("convex/browser");
const { api } = require("./convex/_generated/api");

async function main() {
  const args = process.argv.slice(2);
  const runIdIndex = args.indexOf("--run-id");
  if (runIdIndex === -1 || !args[runIdIndex + 1]) {
    console.error("Usage: node test.js --run-id <run-id>");
    process.exit(1);
  }
  const runId = args[runIdIndex + 1];

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("CONVEX_URL environment variable is not set");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  // 2. Insert 3 messages
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

  // 3. Wait for the search index to update
  let results;
  for (let i = 0; i < 20; i++) {
    results = await client.query(api.messages.search, {
      query: "Hello",
      channelId: runId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    if (results.page.length >= 2) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 5. Print the page array
  console.log(JSON.stringify(results.page));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
