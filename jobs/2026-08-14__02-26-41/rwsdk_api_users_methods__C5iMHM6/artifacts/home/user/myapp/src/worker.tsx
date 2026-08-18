import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

interface User {
  id: string;
  name: string;
  email: string;
}

const usersMap = new Map<string, User>();

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/api/users", {
      get: () => {
        const sortedUsers = Array.from(usersMap.values());
        return Response.json(
          { users: sortedUsers },
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
      post: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch (e) {
          return Response.json(
            { error: "invalid payload" },
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (
          !body ||
          typeof body !== "object" ||
          typeof body.name !== "string" ||
          typeof body.email !== "string"
        ) {
          return Response.json(
            { error: "invalid payload" },
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const id = crypto.randomUUID();
        const user: User = { id, name: body.name, email: body.email };
        usersMap.set(id, user);

        return Response.json(
          user,
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    }),
    route("/api/users/:id", {
      get: ({ params }) => {
        const user = usersMap.get(params.id);
        if (!user) {
          return Response.json(
            { error: "not found" },
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return Response.json(
          user,
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
      put: async ({ params, request }) => {
        const user = usersMap.get(params.id);
        if (!user) {
          return Response.json(
            { error: "not found" },
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        let body: any;
        try {
          body = await request.json();
        } catch (e) {
          return Response.json(
            { error: "invalid payload" },
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (!body || typeof body !== "object") {
          return Response.json(
            { error: "invalid payload" },
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (body.name !== undefined && typeof body.name !== "string") {
          return Response.json(
            { error: "invalid payload" },
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (body.email !== undefined && typeof body.email !== "string") {
          return Response.json(
            { error: "invalid payload" },
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (body.name !== undefined) {
          user.name = body.name;
        }
        if (body.email !== undefined) {
          user.email = body.email;
        }

        usersMap.set(params.id, user);

        return Response.json(
          user,
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
      delete: ({ params }) => {
        const user = usersMap.get(params.id);
        if (!user) {
          return Response.json(
            { error: "not found" },
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        usersMap.delete(params.id);
        return new Response(null, { status: 204 });
      },
    }),
  ]),
]);
