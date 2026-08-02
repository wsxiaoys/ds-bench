import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { getProducts, validateCoupon } from "./src/queries" with { type: "ref" };
import { checkout } from "./src/actions" with { type: "ref" };
import { seedDev } from "./src/seeds" with { type: "ref" };

export default app({
  name: "app",
  title: "app",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  db: {
    seeds: [seedDev],
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    query(getProducts, { entities: ["Product"] }),
    query(validateCoupon, { entities: ["Coupon"] }),
    action(checkout, { entities: ["Product", "Coupon", "Order", "OrderItem"] }),
  ],
});
