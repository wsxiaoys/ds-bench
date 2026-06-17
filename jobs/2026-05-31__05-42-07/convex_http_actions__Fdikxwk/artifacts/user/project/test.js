const { ConvexHttpClient } = require("convex/browser");
const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function main() {
  const result = await client.query("webhooks:get_webhook", { runId: "123" });
  console.log(result);
}
main();
