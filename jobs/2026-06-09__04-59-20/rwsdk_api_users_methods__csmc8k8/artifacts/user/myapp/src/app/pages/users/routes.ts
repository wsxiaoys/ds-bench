import { route } from "rwsdk/router";

export type User = {
  id: string;
  name: string;
  email: string;
};

// Module-level in-memory store — persists for the lifetime of the worker instance.
const users = new Map<string, User>();

export const routes = [
  route("/users", {
    get: () => {
      return Response.json({ users: Array.from(users.values()) }, { status: 200 });
    },

    post: async ({ request }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (
        typeof body !== "object" ||
        body === null ||
        typeof (body as Record<string, unknown>).name !== "string" ||
        typeof (body as Record<string, unknown>).email !== "string"
      ) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const { name, email } = body as { name: string; email: string };
      const id = crypto.randomUUID();
      const user: User = { id, name, email };
      users.set(id, user);

      return Response.json(user, { status: 201 });
    },
  }),

  route("/users/:id", {
    get: ({ params }) => {
      const user = users.get(params.id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      return Response.json(user, { status: 200 });
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
        body = {};
      }

      const patch = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

      const updated: User = {
        ...user,
        ...(typeof patch.name === "string" ? { name: patch.name } : {}),
        ...(typeof patch.email === "string" ? { email: patch.email } : {}),
      };

      users.set(params.id, updated);
      return Response.json(updated, { status: 200 });
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
