import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import { api } from "./convex/_generated/api";

async function main() {
  const url = process.env.CONVEX_URL!;
  const runId = fs.readFileSync("/logs/artifacts/run-id", "utf-8").trim();
  const client = new ConvexHttpClient(url);

  console.log("Run ID:", runId);
  console.log("URL:", url);

  console.log("\nSeeding products...");
  const seedResult = await client.mutation(api.products.seed, { runId });
  console.log("Seed result:", seedResult);

  console.log("\nQuerying getByCategory (Electronics)...");
  const electronics = await client.query(api.products.getByCategory, {
    runId,
    category: "Electronics",
  });
  console.log(`Found ${electronics.length} electronics products:`);
  for (const p of electronics) {
    console.log(`  - ${p.name}: $${p.price} (${p.category})`);
  }

  console.log("\nQuerying getCheapByCategory (Electronics, maxPrice=1000)...");
  const cheap = await client.query(api.products.getCheapByCategory, {
    runId,
    category: "Electronics",
    maxPrice: 1000,
  });
  console.log(`Found ${cheap.length} cheap electronics products:`);
  for (const p of cheap) {
    console.log(`  - ${p.name}: $${p.price} (${p.category})`);
  }

  if (electronics.length === 0) throw new Error("No electronics found");
  if (cheap.length === 0) throw new Error("No cheap products found");
  if (cheap.some((p) => p.price > 1000))
    throw new Error("Filter not working - found product > 1000");
  const has500 = electronics.some((p) => p.price === 500);
  const has1500 = electronics.some((p) => p.price === 1500);
  if (!has500) throw new Error("Missing product with price 500");
  if (!has1500) throw new Error("Missing product with price 1500");

  console.log("\n✅ All tests passed!");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});