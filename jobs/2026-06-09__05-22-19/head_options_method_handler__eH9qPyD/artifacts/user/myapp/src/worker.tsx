import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

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
  render(Document, [route("/", Home)]),
  route("/api/items", {
    get: () => Response.json({ items: ["alpha", "beta", "gamma"] }),
    head: () =>
      new Response(null, {
        status: 200,
        headers: { "X-Items-Count": "3" },
      }),
    post: () => Response.json({ created: true }, { status: 201 }),
    delete: () => new Response(null, { status: 204 }),
  }),
  route("/api/no-options", {
    get: () => new Response("ok", { status: 200 }),
    config: { disableOptions: true },
  }),
]);
