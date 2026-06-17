import { render, route } from "rwsdk/router";
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
  render(Document, [route("/", Home)]),
]);

// Route handlers that may throw — executed outside of defineApp so
// errors bubble up to the global wrapper below.
async function handleTestRoutes(
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/ok") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (pathname === "/err/known") {
    throw new ErrorResponse(404, "resource missing");
  }

  if (pathname === "/err/teapot") {
    throw new ErrorResponse(418, "teapot");
  }

  if (pathname === "/err/boom") {
    throw new Error("kaboom!");
  }

  return null;
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      const testResponse = await handleTestRoutes(request);
      if (testResponse !== null) {
        return testResponse;
      }
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
        JSON.stringify({
          error: "internal",
          message: String((error as any)?.message ?? error),
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  },
};
