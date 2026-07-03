import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { Todos } from "@/app/pages/todos";
import {
  listTodosFromDb,
  resetTodosInDb,
} from "@/app/todosDb";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),

    // Server-rendered todo list. `<form action={addTodo}>` and
    // `<form action={deleteTodo}>` in this page POST to the framework's
    // built-in `__rsc_action_id` endpoint, which rehydrates the page
    // after invoking the corresponding `serverAction`.
    route("/todos", Todos),

    // JSON sanity-check endpoint used by the verifier.
    route("/todos.json", {
      get: () =>
        Response.json({
          todos: listTodosFromDb(),
        }),
    }),

    // Verifier entry-point that wipes the in-memory list.
    route("/todos.reset", {
      post: () => {
        resetTodosInDb();
        return new Response("reset");
      },
    }),
  ]),
]);
