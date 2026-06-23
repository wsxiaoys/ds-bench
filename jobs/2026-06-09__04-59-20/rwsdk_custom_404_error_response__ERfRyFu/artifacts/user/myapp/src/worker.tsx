import { render, route, except } from "rwsdk/router";
import { defineApp, ErrorResponse, renderToString } from "rwsdk/worker";

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
  except((error) => {
    if (error instanceof ErrorResponse) {
      return new Response(error.message, { status: error.code });
    }
  }),
  route("/healthcheck", () => {
    return new Response("ok", { status: 200 });
  }),
  route("/boom", () => {
    throw new ErrorResponse(418, "Short and stout");
  }),
  render(Document, [
    route("/home", Home),
  ]),
  route("/*", async () => {
    const html = await renderToString(<NotFound />);
    return new Response("<!DOCTYPE html>" + html, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }),
]);
