const { ConvexHttpClient } = require("convex/browser");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-id") {
      opts.runId = args[i + 1];
      i++;
    }
  }
  if (!opts.runId) {
    console.error("Usage: node test.js --run-id <run-id>");
    process.exit(1);
  }
  return opts;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { runId } = parseArgs();
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("CONVEX_URL environment variable is not set");
    process.exit(1);
  }
  const client = new ConvexHttpClient(convexUrl);

  // Insert 3 messages
  const messages = [
    { body: "Hello world", author: "Alice" },
    { body: "Hello Convex", author: "Bob" },
    { body: "Hello search", author: "Charlie" },
  ];

  for (const msg of messages) {
    await client.mutation("messages:insert", {
      body: msg.body,
      author: msg.author,
      runId,
    });
  }

  // Poll until search results are found
  let result;
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      result = await client.query("messages:search", {
        query: "Hello",
        runId,
        paginationOpts: { numItems: 2, cursor: null },
      });
      if (result && Array.isArray(result.page) && result.page.length > 0) {
        break;
      }
    } catch (e) {
      // swallow and retry
    }
    await sleep(1000);
  }

  if (!result || !Array.isArray(result.page)) {
    console.error("Search did not return results");
    process.exit(1);
  }

  console.log(JSON.stringify(result.page));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
