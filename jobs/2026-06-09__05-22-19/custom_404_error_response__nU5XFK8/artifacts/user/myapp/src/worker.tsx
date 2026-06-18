import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { NotFound } from "@/app/pages/not-found";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/home", Home),
    route("/boom", () => {
      throw new ErrorResponse(418, "Short and stout");
    }),
    route("/healthcheck", () => new Response("ok", { status: 200 })),
    route("/*", ({ response }) => {
      response.status = 404;
      return <NotFound />;
    }),
  ]),
]);