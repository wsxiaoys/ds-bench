import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { NotFound } from "@/app/pages/not-found";
import { boomHandler } from "@/app/pages/boom";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/healthcheck", () => new Response("ok", { status: 200 })),
  route("/boom", boomHandler),
  render(Document, [
    route("/home", () => <Home />),
    route("*", () => <NotFound />),
  ]),
]);
