import { app, page, query, route } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { getProductsWithFilters } from "./src/queries" with { type: "ref" };
import { devSeed } from "./src/dbSeeds" with { type: "ref" };

export default app({
  name: "app",
  title: "app",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  db: {
    seeds: [devSeed],
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    query(getProductsWithFilters, { entities: ["Product"] }),
  ],
});
