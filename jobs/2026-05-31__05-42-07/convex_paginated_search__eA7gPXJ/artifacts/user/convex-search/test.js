const { ConvexHttpClient } = require("convex/browser");

const args = process.argv.slice(2);
const runIdIndex = args.indexOf("--run-id");
if (runIdIndex === -1 || runIdIndex === args.length - 1) {
  console.error("Missing --run-id argument");
  process.exit(1);
}
const runId = args[runIdIndex + 1];

const url = process.env.CONVEX_URL;
if (!url) {
  console.error("Missing CONVEX_URL");
  process.exit(1);
}

const client = new ConvexHttpClient(url);

async function main() {
  await client.mutation("messages:insert", {
    body: "Hello world",
    author: "Alice",
    channelId: runId,
  });
  await client.mutation("messages:insert", {
    body: "Hello Convex",
    author: "Bob",
    channelId: runId,
  });
  await client.mutation("messages:insert", {
    body: "Hello search",
    author: "Charlie",
    channelId: runId,
  });

  let result = null;
  for (let i = 0; i < 20; i++) {
    result = await client.query("messages:search", {
      query: "Hello",
      channelId: runId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    
    if (result && result.page && result.page.length > 0) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  console.log(JSON.stringify(result.page));
}

main().catch(console.error);
