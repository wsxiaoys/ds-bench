import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { TodosPage } from "@/app/pages/todos";
import { todos, resetTodos } from "@/app/todosStore";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/todos", () => <TodosPage />),
    route("/todos.json", {
      get: () => Response.json({ todos }),
    }),
    route("/todos.reset", {
      post: () => {
        resetTodos();
        return new Response("reset", {
          headers: { "Content-Type": "text/plain" },
        });
      },
    }),
  ]),
]);
