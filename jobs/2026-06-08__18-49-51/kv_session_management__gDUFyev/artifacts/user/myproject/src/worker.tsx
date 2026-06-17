import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { sessionsHandler } from "@/app/api/sessions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/sessions/me", {
    get: ({ request }) => sessionsHandler(request),
    delete: ({ request }) => sessionsHandler(request),
  }),
  route("/api/sessions/count", {
    get: ({ request }) => sessionsHandler(request),
  }),
  route("/api/sessions", {
    post: ({ request }) => sessionsHandler(request),
  }),
  render(Document, [route("/", Home)]),
]);
