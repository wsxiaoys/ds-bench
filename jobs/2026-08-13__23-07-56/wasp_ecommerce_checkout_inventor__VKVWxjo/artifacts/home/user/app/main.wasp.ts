import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { getProducts } from "./src/queries" with { type: "ref" };
import { applyCoupon, checkout } from "./src/actions" with { type: "ref" };
import { devSeed } from "./src/dbSeeds" with { type: "ref" };

export default app({
  name: "app",
  title: "Wasp E-commerce Checkout",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  db: {
    seeds: [devSeed],
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    query(getProducts, {
      entities: ["Product", "Coupon"],
    }),
    action(applyCoupon, {
      entities: ["Coupon"],
    }),
    action(checkout, {
      entities: ["Product", "Coupon", "Order", "OrderItem"],
    }),
  ],
});
