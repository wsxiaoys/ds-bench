import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { isAuthenticated } from "@/app/auth/interrupters";
import {
  dashboardPage,
  homePage,
  loginPage,
  loginSubmit,
  logout,
} from "@/app/auth/pages";

export type AppContext = {
  /** Set by `isAuthenticated` when the request carries a valid session. */
  user?: { username: string };
};

export default defineApp([
  setCommonHeaders(),
  render(Document, [
    route("/", homePage),
    route("/login", {
      get: () => loginPage(),
      post: loginSubmit,
    }),
    route("/dashboard", [isAuthenticated, dashboardPage]),
    route("/logout", logout),
  ]),
]);