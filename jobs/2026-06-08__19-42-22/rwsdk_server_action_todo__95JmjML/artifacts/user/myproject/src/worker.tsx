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
  route("/api/todos", {
    get: async () => {
      const list = await env.TODOS.list({ prefix: "todo:" });
      const todos = [];
      
      for (const key of list.keys) {
        const data = await env.TODOS.get(key.name);
        if (data) {
          todos.push(JSON.parse(data));
        }
      }

      todos.sort((a, b) => a.createdAt - b.createdAt);
      const remaining = todos.filter((t) => !t.done).length;

      return Response.json({ todos, remaining });
    }
  }),
  render(Document, [route("/", Home)]),
]);
