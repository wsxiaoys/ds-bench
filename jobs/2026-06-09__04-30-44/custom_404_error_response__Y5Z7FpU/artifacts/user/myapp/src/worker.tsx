import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const NotFoundPage = () => {
  return (
    <div>
      <h1>Page Not Found</h1>
      <p>The page you requested could not be found.</p>
    </div>
  );
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/home", Home),
    route("/healthcheck", () => new Response("ok", { status: 200 })),
    route("/boom", () => {
      throw new ErrorResponse(418, "Short and stout");
    }),
    route("/*", ({ response }) => {
      if (response) {
        response.status = 404;
      }
      return <NotFoundPage />;
    }),
  ]),
]);
