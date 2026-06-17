import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { About } from "@/app/pages/about";
import { UserProfile } from "@/app/pages/user-profile";

export type AppContext = {};

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/home", Home),
    route("/about", About),
    route("/users/:id", UserProfile)
  ]),
]);

export type App = typeof app;
export default app;
