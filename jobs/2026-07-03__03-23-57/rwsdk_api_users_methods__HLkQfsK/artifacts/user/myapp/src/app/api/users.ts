import { route } from "rwsdk/router";

export interface User {
  id: string;
  name: string;
  email: string;
}

// Persist state in a module-level Map<string, User>
const usersMap = new Map<string, User>();

const jsonResponse = (data: any, status = 200) => {
  return Response.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const apiUsersRoutes = [
  route("/api/users", {
    get: () => {
      const users = Array.from(usersMap.values());
      return jsonResponse({ users });
    },
    post: async ({ request }) => {
      let payload: any;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ error: "invalid payload" }, 400);
      }

      if (!payload || typeof payload !== "object") {
        return jsonResponse({ error: "invalid payload" }, 400);
      }

      const { name, email } = payload;
      if (typeof name !== "string" || typeof email !== "string") {
        return jsonResponse({ error: "invalid payload" }, 400);
      }

      const id = crypto.randomUUID();
      const newUser: User = { id, name, email };
      usersMap.set(id, newUser);

      return jsonResponse(newUser, 201);
    },
  }),

  route("/api/users/:id", {
    get: ({ params }) => {
      const { id } = params;
      const user = usersMap.get(id);
      if (!user) {
        return jsonResponse({ error: "not found" }, 404);
      }
      return jsonResponse(user, 200);
    },
    put: async ({ request, params }) => {
      const { id } = params;
      const user = usersMap.get(id);
      if (!user) {
        return jsonResponse({ error: "not found" }, 404);
      }

      let payload: any;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ error: "invalid payload" }, 400);
      }

      if (!payload || typeof payload !== "object") {
        return jsonResponse({ error: "invalid payload" }, 400);
      }

      const { name, email } = payload;
      if (name !== undefined && typeof name !== "string") {
        return jsonResponse({ error: "invalid payload" }, 400);
      }
      if (email !== undefined && typeof email !== "string") {
        return jsonResponse({ error: "invalid payload" }, 400);
      }

      if (name !== undefined) {
        user.name = name;
      }
      if (email !== undefined) {
        user.email = email;
      }

      usersMap.set(id, user);
      return jsonResponse(user, 200);
    },
    delete: ({ params }) => {
      const { id } = params;
      const user = usersMap.get(id);
      if (!user) {
        return jsonResponse({ error: "not found" }, 404);
      }

      usersMap.delete(id);
      return new Response(null, { status: 204 });
    },
  }),
];
