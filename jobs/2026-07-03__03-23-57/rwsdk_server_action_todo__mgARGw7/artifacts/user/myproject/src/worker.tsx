import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/api/todos", {
      get: async () => {
        const list = await env.TODOS.list({ prefix: "todo:" });
        const todos: any[] = [];
        for (const key of list.keys) {
          const val = await env.TODOS.get(key.name);
          if (val) {
            todos.push(JSON.parse(val));
          }
        }
        todos.sort((a, b) => a.createdAt - b.createdAt);
        const remaining = todos.filter((t) => !t.done).length;
        return Response.json({ todos, remaining });
      },
    }),
  ]),
]);
