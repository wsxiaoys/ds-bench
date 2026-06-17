import { route } from "rwsdk/router";

interface User {
  id: string;
  name: string;
  email: string;
}

const users = new Map<string, User>();

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export const usersRoutes = [
  route("/api/users", {
    get: () => {
      const all = Array.from(users.values());
      return Response.json({ users: all });
    },
    post: async ({ request }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (
        body == null ||
        typeof body !== "object" ||
        !("name" in body) ||
        !("email" in body) ||
        !isString((body as Record<string, unknown>).name) ||
        !isString((body as Record<string, unknown>).email)
      ) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const { name, email } = body as { name: string; email: string };
      const user: User = { id: crypto.randomUUID(), name, email };
      users.set(user.id, user);
      return Response.json(user, { status: 201 });
    },
  }),

  route("/api/users/:id", {
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

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (body == null || typeof body !== "object") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const updates = body as { name?: unknown; email?: unknown };

      if ("name" in updates) {
        if (!isString(updates.name)) {
          return Response.json({ error: "invalid payload" }, { status: 400 });
        }
        user.name = updates.name;
      }

      if ("email" in updates) {
        if (!isString(updates.email)) {
          return Response.json({ error: "invalid payload" }, { status: 400 });
        }
        user.email = updates.email;
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
  }),
];
