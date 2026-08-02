import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { getProducts, getCart } from "./src/queries" with { type: "ref" };
import { addToCart, applyCoupon, checkout } from "./src/actions" with { type: "ref" };
import { devSeed } from "./src/dbSeeds" with { type: "ref" };

export default app({
  name: "app",
  title: "E-Commerce Store",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  db: {
    seeds: [devSeed],
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    query(getProducts, { entities: ["Product"] }),
    query(getCart, { entities: ["Product"] }),
    action(addToCart, { entities: ["Product"] }),
    action(applyCoupon, { entities: ["Product", "Coupon"] }),
    action(checkout, { entities: ["Product", "Coupon", "Order", "OrderItem"] }),
  ],
});
