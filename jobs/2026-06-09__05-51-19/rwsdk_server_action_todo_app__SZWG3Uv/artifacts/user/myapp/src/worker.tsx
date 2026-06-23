import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { Todos } from "@/app/pages/todos";
import { getTodos, resetTodos } from "@/app/pages/todos.actions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/todos.json", {
    get: () => {
      return Response.json({ todos: getTodos() });
    },
  }),
  route("/todos.reset", {
    post: () => {
      resetTodos();
      return new Response("reset");
    },
  }),
  render(Document, [route("/", Home), route("/todos", Todos)]),
]);
