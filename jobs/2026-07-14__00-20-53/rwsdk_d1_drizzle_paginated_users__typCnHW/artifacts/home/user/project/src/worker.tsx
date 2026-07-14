import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { createUser, listUsers } from "@/app/api/users";
import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

/**
 * Per-request context. Anything stored here is available to every
 * middleware and route handler via the `ctx` argument on `RequestInfo`.
 */
export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  route("/api/users", {
    get: listUsers,
    post: createUser,
  }),
  render(Document, [route("/", Home)]),
]);