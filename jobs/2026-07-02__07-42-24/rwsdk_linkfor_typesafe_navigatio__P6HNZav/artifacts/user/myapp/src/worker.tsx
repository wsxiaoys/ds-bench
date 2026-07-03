import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { HomePage } from "@/app/pages/home-page";
import { AboutPage } from "@/app/pages/about-page";
import { UserPage } from "@/app/pages/user-page";

export type AppContext = {};

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/home", HomePage),
    route("/about", AboutPage),
    route("/users/:id", UserPage),
  ]),
]);

export type App = typeof app;
export default app;
