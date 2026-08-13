import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };
import { getTickets, getAgents } from "./src/queries" with { type: "ref" };
import { createTicket, simulateSlaBreach } from "./src/actions" with { type: "ref" };
import { userSignupFields } from "./src/auth/signup" with { type: "ref" };
import { seedData } from "./src/seeds" with { type: "ref" };

export default app({
  name: "app",
  title: "app",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {
        userSignupFields,
      },
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
    query(getTickets, { entities: ["Ticket"] }),
    query(getAgents, { entities: ["User", "Ticket"] }),
    action(createTicket, { entities: ["Ticket", "User"] }),
    action(simulateSlaBreach, { entities: ["Ticket", "User"] }),
  ],
});
