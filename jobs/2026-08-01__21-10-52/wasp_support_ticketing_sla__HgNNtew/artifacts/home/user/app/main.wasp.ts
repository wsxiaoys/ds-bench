import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage, SignupPage } from "./src/auth/pages" with { type: "ref" };
import { userSignupFields } from "./src/auth/signup" with { type: "ref" };
import { getTickets, getAgents, createTicket, simulateSlaBreach, resolveTicket } from "./src/operations" with { type: "ref" };
import { seedData } from "./src/seed" with { type: "ref" };

export default app({
  name: "app",
  title: "Customer Support System",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {
        userSignupFields
      }
    },
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/"
  },
  db: {
    seeds: [seedData]
  },
  spec: [
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    
    query(getTickets, { entities: ["Ticket", "User"] }),
    query(getAgents, { entities: ["Ticket", "User"] }),
    action(createTicket, { entities: ["Ticket", "User"] }),
    action(simulateSlaBreach, { entities: ["Ticket", "User"] }),
    action(resolveTicket, { entities: ["Ticket", "User"] }),
  ],
});
