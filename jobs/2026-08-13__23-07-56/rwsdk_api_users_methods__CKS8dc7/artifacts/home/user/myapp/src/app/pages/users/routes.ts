import { route } from "rwsdk/router";

export interface User {
  id: string;
  name: string;
  email: string;
}

// Module-level in-memory storage
const users = new Map<string, User>();

export const userRoutes = [
  route("/", {
    get: () => {
      // Returns a status code of 200 with the body {"users": [...]} containing an array of all users sorted by insertion order.
      // If there are no users, return an empty array.
      const userList = Array.from(users.values());
      return Response.json({ users: userList }, { status: 200 });
    },
    post: async ({ request }) => {
      // Accepts a JSON body containing {name, email}.
      // Returns a status code of 201 with the created user object {id, name, email} containing the newly generated ID.
      // If name or email is missing, or is not a string, return a status code of 400 with the body {"error": "invalid payload"}.
      let payload: any;
      try {
        payload = await request.json();
      } catch (e) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (!payload || typeof payload !== "object") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const { name, email } = payload;
      if (typeof name !== "string" || typeof email !== "string") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const user: User = { id, name, email };
      users.set(id, user);

      return Response.json(user, { status: 201 });
    },
  }),
  route("/:id", {
    get: ({ params }) => {
      // Returns a status code of 200 with the user object if the user is found.
      // If the user does not exist, return a status code of 404 with the body {"error": "not found"}.
      const { id } = params;
      const user = users.get(id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      return Response.json(user, { status: 200 });
    },
    put: async ({ params, request }) => {
      // Accepts a JSON body containing optional {name?, email?} fields.
      // Updates the corresponding user and returns a status code of 200 with the updated user object.
      // If the user does not exist, return a status code of 404.
      const { id } = params;
      const user = users.get(id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }

      let payload: any;
      try {
        payload = await request.json();
      } catch (e) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      if (!payload || typeof payload !== "object") {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }

      const { name, email } = payload;

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

      return Response.json(user, { status: 200 });
    },
    delete: ({ params }) => {
      // Deletes the user with the given ID.
      // Returns a status code of 204 with an empty body if the user is found and successfully deleted.
      // If the user does not exist, return a status code of 404 with the body {"error": "not found"}.
      const { id } = params;
      if (!users.has(id)) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      users.delete(id);
      return new Response(null, { status: 204 });
    },
  }),
];
