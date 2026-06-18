import { render, route, except } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  except((error) => {
    if (error instanceof ErrorResponse) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        {
          status: error.code,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }),
  route("/ok", () => new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })),
  route("/err/known", () => {
    throw new ErrorResponse(404, "resource missing");
  }),
  route("/err/teapot", () => {
    throw new ErrorResponse(418, "teapot");
  }),
  route("/err/boom", () => {
    throw new Error("kaboom!");
  }),
  render(Document, [route("/", Home)]),
]);

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      return await app.fetch(request, env, ctx);
    } catch (error) {
      if (error instanceof ErrorResponse) {
        return new Response(
          JSON.stringify({ error: error.message, code: error.code }),
          {
            status: error.code,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({ error: "internal", message: String(error?.message ?? error) }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  },
};