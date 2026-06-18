import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { getTodos } from "@/app/todos/kv";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/todos", async () => {
    const todos = await getTodos();
    const remaining = todos.filter((t) => !t.done).length;
    return Response.json({ todos, remaining });
  }),
  render(Document, [route("/", Home)]),
]);
