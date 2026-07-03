import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import {
  createSessionHandler,
  getSessionHandler,
  deleteSessionHandler,
  countSessionsHandler,
} from "@/app/sessions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/sessions", {
    post: createSessionHandler,
  }),
  route("/api/sessions/me", {
    get: getSessionHandler,
    delete: deleteSessionHandler,
  }),
  route("/api/sessions/count", {
    get: countSessionsHandler,
  }),
  render(Document, [route("/", Home)]),
]);
