import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

export interface User {
  id: string;
  name: string;
  email: string;
}

const users = new Map<string, User>();

const apiUsersRoute = route("/api/users", {
  get: () => {
    return Response.json({ users: Array.from(users.values()) });
  },
  post: async ({ request }) => {
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }

    if (
      !body ||
      typeof body !== "object" ||
      typeof body.name !== "string" ||
      typeof body.email !== "string"
    ) {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name: body.name,
      email: body.email,
    };

    users.set(newUser.id, newUser);

    return Response.json(newUser, { status: 201 });
  },
});

const apiUserRoute = route("/api/users/:id", {
  get: ({ params }) => {
    const user = users.get(params.id);
    if (!user) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return Response.json(user);
  },
  put: async ({ params, request }) => {
    const user = users.get(params.id);
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

    if (body.name !== undefined && typeof body.name !== "string") {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }

    if (body.email !== undefined && typeof body.email !== "string") {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }

    if (body.name !== undefined) {
      user.name = body.name;
    }
    if (body.email !== undefined) {
      user.email = body.email;
    }

    return Response.json(user);
  },
  delete: ({ params }) => {
    if (!users.has(params.id)) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    users.delete(params.id);
    return new Response(null, { status: 204 });
  },
});

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  apiUsersRoute,
  apiUserRoute,
  render(Document, [route("/", Home)]),
]);
