import { ConvexHttpClient } from "convex/browser";
import process from "node:process";

const client = new ConvexHttpClient(process.env.CONVEX_URL);
const runId = "zrpt7obe0z";

async function main() {
  // Seed
  await client.mutation("products:seed", { runId });
  console.log("Seed complete");

  // getByCategory
  const electronics = await client.query("products:getByCategory", {
    runId,
    category: "Electronics",
  });
  console.log("getByCategory (Electronics):", electronics.length, "products");
  console.log(electronics.map((p) => ({ name: p.name, price: p.price })));

  // getCheapByCategory - maxPrice 1000 should include price 500 but not 1500
  const cheap = await client.query("products:getCheapByCategory", {
    runId,
    category: "Electronics",
    maxPrice: 1000,
  });
  console.log("getCheapByCategory (Electronics, <=1000):", cheap.length, "products");
  console.log(cheap.map((p) => ({ name: p.name, price: p.price })));

  if (!electronics.some((p) => p.price === 500)) {
    throw new Error("Missing Electronics product with price 500");
  }
  if (!electronics.some((p) => p.price === 1500)) {
    throw new Error("Missing Electronics product with price 1500");
  }
  if (!cheap.some((p) => p.price === 500)) {
    throw new Error("getCheapByCategory should include price 500");
  }
  if (cheap.some((p) => p.price === 1500)) {
    throw new Error("getCheapByCategory should NOT include price 1500");
  }
  console.log("All assertions passed!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});