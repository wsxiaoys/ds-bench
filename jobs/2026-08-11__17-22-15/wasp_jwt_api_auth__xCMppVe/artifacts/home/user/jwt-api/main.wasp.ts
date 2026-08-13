import { app, page, route } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };

export default app({
  name: "jwtApi",
  wasp: { version: "^0.25.0" },
  title: "jwt-api",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  spec: [
    route("RootRoute", "/", page(MainPage)),
  ],
});
