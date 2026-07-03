import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { getAllTodos } from "@/app/pages/todos/kv";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/api/todos", async () => {
      const todos = await getAllTodos();
      const remaining = todos.filter((t) => !t.done).length;
      return Response.json({ todos, remaining }, {
        headers: { "Content-Type": "application/json" },
      });
    }),
  ]),
]);