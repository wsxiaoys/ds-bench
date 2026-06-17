import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import {
  handlePostSessions,
  handleGetMe,
  handleDeleteMe,
  handleGetCount,
} from "@/app/sessions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", Home)]),
  route("/api/sessions", {
    post: handlePostSessions,
  }),
  route("/api/sessions/me", {
    get: handleGetMe,
    delete: handleDeleteMe,
  }),
  route("/api/sessions/count", {
    get: handleGetCount,
  }),
]);
