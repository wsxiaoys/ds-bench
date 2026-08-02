import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { getAnalytics } from "./src/queries" with { type: "ref" };
import { createTransaction } from "./src/actions" with { type: "ref" };
import { seedData } from "./src/dbSeeds" with { type: "ref" };

export default app({
  name: "financial_analytics",
  title: "Financial Analytics Dashboard",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  db: {
    seeds: [seedData],
  },
  spec: [
    route("MainRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    query(getAnalytics, { entities: ["Transaction"] }),
    action(createTransaction, { entities: ["Transaction"] }),
  ],
});
