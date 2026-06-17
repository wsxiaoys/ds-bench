import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { About } from "@/app/pages/about";
import { UserProfile } from "@/app/pages/userProfile";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/home", Home),
    route("/about", About),
    route("/users/:id", UserProfile),
  ]),
]);
export type App = typeof import("./worker").default;
