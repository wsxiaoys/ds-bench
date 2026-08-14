import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";

export type AppContext = {};

interface User {
  id: string;
  name: string;
  email: string;
}

const usersMap = new Map<string, User>();

const HomeRoute = async () => {
  const { Home } = await import("@/app/pages/home");
  return <Home />;
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/users", {
    get: () => {
      const users = Array.from(usersMap.values());
      return Response.json({ users }, { status: 200 });
    },
    post: async ({ request }) => {
      let body: any;
      try {
        body = await request.json();
      } catch (e) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (!body || typeof body !== "object") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const { name, email } = body;
      if (typeof name !== "string" || typeof email !== "string") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const newUser: User = { id, name, email };
      usersMap.set(id, newUser);

      return Response.json(newUser, { status: 201 });
    },
  }),
  route("/api/users/:id", {
    get: ({ params }) => {
      const user = usersMap.get(params.id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      return Response.json(user, { status: 200 });
    },
    put: async ({ params, request }) => {
      const user = usersMap.get(params.id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }

      let body: any;
      try {
        body = await request.json();
      } catch (e) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (!body || typeof body !== "object") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const { name, email } = body;
      if (name !== undefined && typeof name !== "string") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }
      if (email !== undefined && typeof email !== "string") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (name !== undefined) {
        user.name = name;
      }
      if (email !== undefined) {
        user.email = email;
      }

      usersMap.set(params.id, user);
      return Response.json(user, { status: 200 });
    },
    delete: ({ params }) => {
      const user = usersMap.get(params.id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      usersMap.delete(params.id);
      return new Response(null, { status: 204 });
    },
  }),
  render(Document, [route("/", HomeRoute)]),
]);
