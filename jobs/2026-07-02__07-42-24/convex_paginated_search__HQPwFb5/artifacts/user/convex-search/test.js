const { ConvexHttpClient } = require("convex/browser");

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let runId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-id" && i + 1 < args.length) {
      runId = args[i + 1];
      break;
    }
  }

  if (!runId) {
    console.error("Error: --run-id <run-id> is required.");
    process.exit(1);
  }

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Error: CONVEX_URL environment variable is required.");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  // Insert 3 messages with the provided run-id as the runId:
  // * body: "Hello world", author: "Alice"
  // * body: "Hello Convex", author: "Bob"
  // * body: "Hello search", author: "Charlie"
  console.error(`Inserting messages for runId: ${runId}`);
  await client.mutation("messages:insert", { body: "Hello world", author: "Alice", runId });
  await client.mutation("messages:insert", { body: "Hello Convex", author: "Bob", runId });
  await client.mutation("messages:insert", { body: "Hello search", author: "Charlie", runId });

  // Wait for the search index to update
  console.error("Waiting for search index to update...");
  let pageResults = null;
  const maxRetries = 60;
  const delayMs = 1000;
  for (let i = 0; i < maxRetries; i++) {
    const checkAll = await client.query("messages:search", {
      query: "Hello",
      runId: runId,
      paginationOpts: { numItems: 5, cursor: null }
    });

    if (checkAll && checkAll.page && checkAll.page.length === 3) {
      // Perform the actual paginated search query fetching exactly 2 items per page
      pageResults = await client.query("messages:search", {
        query: "Hello",
        runId: runId,
        paginationOpts: { numItems: 2, cursor: null }
      });
      break;
    }
    
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (!pageResults) {
    console.error("Timeout waiting for search index to update.");
    process.exit(1);
  }

  // Print the page array from the pagination result to stdout as a JSON array
  console.log(JSON.stringify(pageResults.page));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
