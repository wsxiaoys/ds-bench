import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import sessionsHandler from "@/app/sessions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/sessions", sessionsHandler),
  route("/api/sessions/me", sessionsHandler),
  route("/api/sessions/count", sessionsHandler),
  render(Document, [route("/", Home)]),
]);
