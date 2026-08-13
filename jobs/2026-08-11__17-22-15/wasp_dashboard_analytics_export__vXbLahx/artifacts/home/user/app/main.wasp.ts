import { app, page, query, action, route } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { getAnalytics, createTransaction } from "./src/operations" with { type: "ref" };
import { seedData } from "./src/seed" with { type: "ref" };

export default app({
  name: "app",
  title: "app",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {}
    },
    onAuthFailedRedirectTo: "/login"
  },
  db: {
    seeds: [seedData]
  },
  spec: [
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    query(getAnalytics, { entities: ["Transaction"] }),
    action(createTransaction, { entities: ["Transaction"] }),
  ],
});
