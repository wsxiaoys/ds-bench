import { app, page, query, route } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { getProductsWithFilters } from "./src/queries" with { type: "ref" };
import { seedProducts } from "./src/dbSeeds" with { type: "ref" };

export default app({
  name: "app",
  title: "Product Catalog",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  db: {
    seeds: [seedProducts],
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    query(getProductsWithFilters, { entities: ["Product"] }),
  ],
});
