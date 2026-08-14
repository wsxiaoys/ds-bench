import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";

const HomeComponent = () => {
  return <div>Welcome home</div>;
};
(HomeComponent as any).__rwsdk_route_component = true;

const NotFoundComponent = ({ response }: any) => {
  response.status = 404;
  return (
    <div>
      <h1>Page Not Found</h1>
      <p>The page you requested could not be found.</p>
    </div>
  );
};
(NotFoundComponent as any).__rwsdk_route_component = true;

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", HomeComponent),
    route("/home", HomeComponent),
    route("/boom", () => {
      throw new ErrorResponse(418, "Short and stout");
    }),
    route("/healthcheck", () => {
      return new Response("ok", { status: 200 });
    }),
    route("*", NotFoundComponent),
  ]),
]);
