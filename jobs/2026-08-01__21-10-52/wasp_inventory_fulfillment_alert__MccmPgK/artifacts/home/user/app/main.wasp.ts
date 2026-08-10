import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { seedData } from "./src/seeds" with { type: "ref" };

import { getProducts } from "./src/queries/getProducts" with { type: "ref" };
import { getOrders } from "./src/queries/getOrders" with { type: "ref" };
import { getAlerts } from "./src/queries/getAlerts" with { type: "ref" };
import { getPurchaseOrders } from "./src/queries/getPurchaseOrders" with { type: "ref" };

import { fulfillOrder } from "./src/actions/fulfillOrder" with { type: "ref" };

export default app({
  name: "app",
  title: "Warehouse Tracker",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/",
  },
  db: {
    seeds: [seedData],
  },
  spec: [
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    query(getProducts, { entities: ["Product", "Supplier"] }),
    query(getOrders, { entities: ["Order", "OrderItem", "Product"] }),
    query(getAlerts, { entities: ["Alert"] }),
    query(getPurchaseOrders, { entities: ["PurchaseOrder", "Supplier", "Product"] }),

    action(fulfillOrder, { entities: ["Order", "OrderItem", "Product", "Alert", "PurchaseOrder", "Supplier"] }),
  ],
});
