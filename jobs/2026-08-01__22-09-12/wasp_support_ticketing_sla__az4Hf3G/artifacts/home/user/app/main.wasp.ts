import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };
import { getTickets } from "./src/queries" with { type: "ref" };
import { getAgents } from "./src/queries" with { type: "ref" };
import { createTicket } from "./src/actions" with { type: "ref" };
import { simulateSlaBreach } from "./src/actions" with { type: "ref" };
import { seedData } from "./src/dbSeeds" with { type: "ref" };

export default app({
  name: "app",
  title: "app",
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
    route("LoginRoute", "/login", page(LoginPage, { authRequired: false })),
    route("SignupRoute", "/signup", page(SignupPage, { authRequired: false })),
    route("MainRoute", "/", page(MainPage, { authRequired: true })),
    query(getTickets, { entities: ["Ticket"] }),
    query(getAgents, { entities: ["User", "Ticket"] }),
    action(createTicket, { entities: ["Ticket", "User"] }),
    action(simulateSlaBreach, { entities: ["Ticket", "User"] }),
  ],
});
