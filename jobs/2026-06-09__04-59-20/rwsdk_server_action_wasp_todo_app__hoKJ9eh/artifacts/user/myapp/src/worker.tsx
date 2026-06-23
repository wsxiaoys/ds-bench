import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { TodosPage } from "@/app/pages/todos/TodosPage";
import { todos } from "@/app/pages/todos/store";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/todos.json", () => {
    return Response.json({ todos });
  }),
  route("/todos.reset", {
    post: () => {
      todos.splice(0, todos.length);
      return new Response("reset");
    },
  }),
  render(Document, [
    route("/", Home),
    route("/todos", () => <TodosPage />),
  ]),
]);
