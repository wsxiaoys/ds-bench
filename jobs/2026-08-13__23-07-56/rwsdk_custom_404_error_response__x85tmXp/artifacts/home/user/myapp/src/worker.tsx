import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse, RequestInfo } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const WelcomeHome = () => {
  return <div>Welcome home</div>;
};

const NotFoundPage = ({ response }: RequestInfo) => {
  if (response) {
    response.status = 404;
  }
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
    route("/", Home),
    route("/home", WelcomeHome),
    route("/boom", () => {
      throw new ErrorResponse(418, "Short and stout");
    }),
    route("/healthcheck", () => {
      return new Response("ok", { status: 200 });
    }),
    route("/*", NotFoundPage),
  ]),
]);
