import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { TodosPage } from "@/app/pages/todos/page";
import { getTodos, resetTodos } from "@/app/pages/todos/actions";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/todos", TodosPage),
    route("/todos.json", () => {
      return Response.json({ todos: getTodos() });
    }),
    route(
      "/todos.reset",
      {
        post: () => {
          resetTodos();
          return new Response("reset");
        },
      },
    ),
  ]),
]);
