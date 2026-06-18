import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const items = ["alpha", "beta", "gamma"];

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/items", {
    get: () => Response.json({ items }),
    head: () =>
      new Response(null, {
        status: 200,
        headers: { "X-Items-Count": String(items.length) },
      }),
    post: () => Response.json({ created: true }, { status: 201 }),
    delete: () => new Response(null, { status: 204 }),
  }),
  route("/api/no-options", {
    get: () => new Response("ok"),
    config: {
      disableOptions: true,
    },
  }),
  render(Document, [route("/", Home)]),
]);
