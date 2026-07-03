import { route, prefix } from "rwsdk/router";

export type User = {
  id: string;
  name: string;
  email: string;
};

// Module-level in-memory store. A Map preserves insertion order, so
// iterating its values returns users in the order they were created.
const users = new Map<string, User>();

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const usersRoutes = prefix("/api/users", [
  // GET /api/users -> all users (insertion order)
  // POST /api/users -> create a user
  route("/", {
    get: () => json({ users: Array.from(users.values()) }, 200),

    post: async ({ request }) => {
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "invalid payload" }, 400);
      }

      const body = payload as Record<string, unknown> | null;
      const name = body?.name;
      const email = body?.email;

      if (typeof name !== "string" || typeof email !== "string") {
        return json({ error: "invalid payload" }, 400);
      }

      const user: User = {
        id: crypto.randomUUID(),
        name,
        email,
      };

      users.set(user.id, user);

      return json(user, 201);
    },
  }),

  // GET /api/users/:id -> fetch a user
  // PUT /api/users/:id -> update a user
  // DELETE /api/users/:id -> delete a user
  route("/:id", {
    get: ({ params }) => {
      const user = users.get(params.id);
      if (!user) {
        return json({ error: "not found" }, 404);
      }
      return json(user, 200);
    },

    put: async ({ params, request }) => {
      const user = users.get(params.id);
      if (!user) {
        return json({ error: "not found" }, 404);
      }

      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        payload = {};
      }

      const body = (payload as Record<string, unknown> | null) ?? {};

      if (typeof body.name === "string") {
        user.name = body.name;
      }
      if (typeof body.email === "string") {
        user.email = body.email;
      }

      return json(user, 200);
    },

    delete: ({ params }) => {
      const user = users.get(params.id);
      if (!user) {
        return json({ error: "not found" }, 404);
      }
      users.delete(params.id);
      return new Response(null, { status: 204 });
    },
  }),
]);