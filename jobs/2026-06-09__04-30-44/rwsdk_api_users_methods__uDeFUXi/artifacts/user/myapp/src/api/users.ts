import { route } from "rwsdk/router";

export type User = {
  id: string;
  name: string;
  email: string;
};

const users = new Map<string, User>();

export const usersRoutes = [
  route("/api/users", {
    get: () => {
      const usersList = Array.from(users.values());
      return Response.json({ users: usersList });
    },
    post: async ({ request }) => {
      try {
        const body = (await request.json()) as any;
        if (
          !body ||
          typeof body !== "object" ||
          typeof body.name !== "string" ||
          typeof body.email !== "string"
        ) {
          return Response.json({ error: "invalid payload" }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const newUser: User = {
          id,
          name: body.name,
          email: body.email,
        };

        users.set(id, newUser);

        return Response.json(newUser, { status: 201 });
      } catch (err) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }
    },
  }),
  route("/api/users/:id", {
    get: ({ params }) => {
      const id = params.id;
      const user = users.get(id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      return Response.json(user);
    },
    put: async ({ request, params }) => {
      const id = params.id;
      const user = users.get(id);
      if (!user) {
        return Response.json({ error: "not found" }, { status: 404 });
      }

      try {
        const body = (await request.json()) as any;
        if (body && typeof body === "object") {
          if (typeof body.name === "string") {
            user.name = body.name;
          }
          if (typeof body.email === "string") {
            user.email = body.email;
          }
        }
        users.set(id, user);
        return Response.json(user);
      } catch (err) {
        return Response.json({ error: "invalid payload" }, { status: 400 });
      }
    },
    delete: ({ params }) => {
      const id = params.id;
      if (!users.has(id)) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      users.delete(id);
      return new Response(null, { status: 204 });
    },
  }),
];
