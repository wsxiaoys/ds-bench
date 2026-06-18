const { ConvexHttpClient } = require("convex/browser");

function parseRunId(argv) {
  const runIdIndex = argv.indexOf("--run-id");
  if (runIdIndex === -1 || runIdIndex === argv.length - 1) {
    throw new Error("Usage: node test.js --run-id <run-id>");
  }
  return argv[runIdIndex + 1];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const runId = parseRunId(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }

  const client = new ConvexHttpClient(convexUrl);

  const messages = [
    { body: "Hello world", author: "Alice" },
    { body: "Hello Convex", author: "Bob" },
    { body: "Hello search", author: "Charlie" },
  ];

  for (const message of messages) {
    await client.mutation("messages:insert", {
      ...message,
      channelId: runId,
    });
  }

  let result = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    result = await client.query("messages:search", {
      query: "Hello",
      channelId: runId,
      paginationOpts: { numItems: 2, cursor: null },
    });

    if (result.page && result.page.length > 0) {
      break;
    }

    await sleep(500);
  }

  if (!result || !result.page || result.page.length === 0) {
    throw new Error("Search index did not return results in time");
  }

  process.stdout.write(JSON.stringify(result.page));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
