import { render, route } from "rwsdk/router";
import { defineApp, ErrorResponse } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

// Override Symbol.hasInstance on ErrorResponse to prevent defineApp's internal catch block
// from intercepting ErrorResponse, allowing it to propagate to our global try/catch wrapper.
Object.defineProperty(ErrorResponse, Symbol.hasInstance, {
  value: function (instance: any) {
    if ((globalThis as any).__disableErrorResponseInstanceof) {
      return false;
    }
    return Function.prototype[Symbol.hasInstance].call(ErrorResponse, instance);
  },
  configurable: true,
});

export type AppContext = {};

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/ok", {
      get: () => new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    }),
    route("/err/known", {
      get: () => {
        throw new ErrorResponse(404, "resource missing");
      },
    }),
    route("/err/teapot", {
      get: () => {
        throw new ErrorResponse(418, "teapot");
      },
    }),
    route("/err/boom", {
      get: () => {
        throw new Error("kaboom!");
      },
    }),
  ]),
]);

export default {
  fetch: async (request: Request, env: any, ctx: any) => {
    (globalThis as any).__disableErrorResponseInstanceof = true;
    try {
      return await app.fetch(request, env, ctx);
    } catch (error: any) {
      (globalThis as any).__disableErrorResponseInstanceof = false;
      if (error instanceof ErrorResponse) {
        return new Response(
          JSON.stringify({ error: error.message, code: error.code }),
          {
            status: error.code,
            headers: { "content-type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({
          error: "internal",
          message: String(error?.message ?? error),
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      );
    } finally {
      (globalThis as any).__disableErrorResponseInstanceof = false;
    }
  },
};
