import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
} from "@/app/server/users";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/api/users", {
      get: () => listUsers(),
      post: ({ request }) => createUser(request),
    }),
    route("/api/users/:id", {
      get: ({ params }) => getUser(params.id),
      put: ({ params, request }) => updateUser(params.id, request),
      delete: ({ params }) => deleteUser(params.id),
    }),
  ]),
]);
