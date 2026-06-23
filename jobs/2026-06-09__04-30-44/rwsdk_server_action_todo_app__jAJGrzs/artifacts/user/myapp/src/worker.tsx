import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { Todos, todos } from "@/app/pages/todos";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/todos.json", {
    get: () => Response.json({ todos }),
  }),
  route("/todos.reset", {
    post: () => {
      todos.length = 0;
      return new Response("reset");
    },
  }),
  render(Document, [
    route("/", Home),
    route("/todos", Todos),
  ]),
]);
