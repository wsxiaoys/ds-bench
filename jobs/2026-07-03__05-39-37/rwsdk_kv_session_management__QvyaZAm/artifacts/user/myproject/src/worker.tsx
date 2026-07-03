import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { sessionsHandler } from "@/sessions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // HTTP session store backed by the `SESSIONS` Cloudflare KV binding.
  // A single wildcard route dispatches to `sessionsHandler`, which switches
  // on the request method and path (see src/sessions.ts).
  route("/api/sessions/*", sessionsHandler),
  render(Document, [route("/", Home)]),
]);
