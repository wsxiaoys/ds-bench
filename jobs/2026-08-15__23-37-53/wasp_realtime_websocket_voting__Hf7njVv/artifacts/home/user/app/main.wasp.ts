import { app, page, route, api } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { PollPage } from "./src/PollPage" with { type: "ref" };
import { createPoll, getPollResults } from "./src/api" with { type: "ref" };
import { webSocketFn } from "./src/webSocket" with { type: "ref" };

export default app({
  name: "app",
  wasp: { version: "^0.25.0" },
  title: "PollRoom",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  webSocket: {
    fn: webSocketFn,
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("PollRoute", "/poll/:slug", page(PollPage, { authRequired: true })),
    api("POST", "/api/polls", createPoll, { entities: ["User", "Poll", "PollOption"], auth: true }),
    api("GET", "/api/polls/:slug/results", getPollResults, { entities: ["Poll", "PollOption", "Vote", "User"], auth: false }),
  ],
});
