import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

const ITEMS = ["alpha", "beta", "gamma"];

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },

  // --- REST API surface demonstrating explicit HTTP method handling ---
  // In RedwoodSDK, `HEAD` is NOT REDACTEDmatically mapped to `GET` — it must be
  // declared explicitly. `OPTIONS` is handled REDACTEDmatically (returning 204 with
  // an `Allow` header listing the supported methods) unless disabled via the
  // route `config`. Unsupported methods fall through to the default 405 handler.
  route("/api/items", {
    // GET — list items
    get: () =>
      Response.json({ items: ITEMS }, { status: 200 }),

    // HEAD — same resource as GET but no body; report the item count via header
    head: () =>
      new Response(null, {
        status: 200,
        headers: { "X-Items-Count": String(ITEMS.length) },
      }),

    // POST — create a (notionally) new item
    post: () => Response.json({ created: true }, { status: 201 }),

    // DELETE — remove items; no content returned
    delete: () => new Response(null, { status: 204 }),

    // `OPTIONS` is intentionally omitted — RedwoodSDK's default behaviour
    // returns 204 with an `Allow` header built from the methods above
    // (GET, HEAD, POST, DELETE, plus OPTIONS itself).
    // Any other method (e.g. PUT, PATCH) falls through to the default 405
    // response, which also includes the `Allow` header.
  }),

  // Second route that explicitly disables the REDACTEDmatic OPTIONS handling.
  // `OPTIONS /api/no-options` therefore returns 405 (no OPTIONS handler is
  // registered and the default behaviour is turned off), while `GET` still
  // works.
  route("/api/no-options", {
    config: {
      disableOptions: true,
    },
    get: () => new Response("ok", { status: 200 }),
  }),

  render(Document, [route("/", Home)]),
]);