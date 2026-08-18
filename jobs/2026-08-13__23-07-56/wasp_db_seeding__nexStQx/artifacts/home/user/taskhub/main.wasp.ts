import { app, page, route } from "@wasp.sh/spec"
import { MainPage } from "./src/MainPage" with { type: "ref" }
import { LoginPage, SignupPage } from "./src/pages/auth" with { type: "ref" }
import { devSeed } from "./src/seeds" with { type: "ref" }

export default app({
  name: "taskhub",
  wasp: {
    version: "^0.24",
  },
  title: "TaskHub",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  db: {
    seeds: [
      devSeed,
    ],
  },
  spec: [
    route("RootRoute", "/", page(MainPage)),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
  ],
})
