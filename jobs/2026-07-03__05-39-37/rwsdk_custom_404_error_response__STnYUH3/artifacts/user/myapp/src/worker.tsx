import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { NotFound } from "@/app/pages/notFound";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Non-page routes that return a Response directly
  route("/healthcheck", () => new Response("ok", { status: 200 })),
  // Demonstrate ErrorResponse short-circuiting from rwsdk/worker.
  // Throwing an ErrorResponse surfaces a response with the given
  // status code and message body.
  route("/boom", () => {
    throw new ErrorResponse(418, "Short and stout");
  }),
  // Page routes rendered through the Document component (React/JSX)
  render(Document, [
    route("/home", () => <Home />),
    // Catch-all 404 route — any unmatched URL falls through to here.
    // The middleware sets the HTTP status to 404 before rendering the
    // NotFound page as JSX.
    route("/*", [
      ({ response }) => {
        response.status = 404;
      },
      () => <NotFound />,
    ]),
  ]),
]);