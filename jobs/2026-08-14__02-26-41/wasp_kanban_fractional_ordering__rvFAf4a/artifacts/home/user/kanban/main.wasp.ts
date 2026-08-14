import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { getBoard } from "./src/queries" with { type: "ref" };
import { createColumn, createCard, moveCard } from "./src/actions" with { type: "ref" };

export default app({
  name: "kanban",
  wasp: { version: "^0.25.0" },
  title: "Kanban Board",
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
    action(createCard, { entities: ["Card", "Column"] }),
    action(moveCard, { entities: ["Card", "Column"] }),
  ],
});
