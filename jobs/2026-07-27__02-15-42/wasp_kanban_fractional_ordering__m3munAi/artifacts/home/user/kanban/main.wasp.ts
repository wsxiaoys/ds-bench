import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };
import { getBoard, createColumn, createCard, moveCard } from "./src/operations" with { type: "ref" };

export default app({
  name: "kanban",
  title: "Kanban Board",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  spec: [
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    query(getBoard, { entities: ["Column", "Card"] }),
    action(createColumn, { entities: ["Column"] }),
    action(createCard, { entities: ["Column", "Card"] }),
    action(moveCard, { entities: ["Column", "Card"] }),
  ],
});
