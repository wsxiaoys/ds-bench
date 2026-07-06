import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { HomePage } from "@/app/pages/homePage";
import { NotFound } from "@/app/pages/notFound";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/home", () => <HomePage />),
    route("/healthcheck", () => new Response("ok", { status: 200 })),
    route("/boom", () => {
      throw new ErrorResponse(418, "Short and stout");
    }),
    route("*", ({ response }) => {
      response.status = 404;
      return <NotFound />;
    }),
  ]),
]);