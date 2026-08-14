import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/home", () => (
      <div>
        Welcome home
      </div>
    )),
    route("/healthcheck", () => {
      return new Response("ok", { status: 200 });
    }),
    route("/boom", () => {
      throw new ErrorResponse(418, "Short and stout");
    }),
    route("/*", [
      ({ response }) => {
        response.status = 404;
      },
      () => (
        <div>
          <h1>Page Not Found</h1>
          <p>The page you requested could not be found.</p>
        </div>
      ),
    ]),
  ]),
]);
