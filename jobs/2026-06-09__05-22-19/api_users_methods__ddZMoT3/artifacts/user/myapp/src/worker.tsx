import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {};

// --- In-memory users store ---
interface User {
  id: string;
  name: string;
  email: string;
}

const users = new Map<string, User>();

// --- API route handlers ---

async function handleGetUsers() {
  return Response.json({ users: Array.from(users.values()) });
}

async function handleCreateUser(request: Request) {
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
}

async function handleGetUser(params: { id: string }) {
  const user = users.get(params.id);
  if (!user) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(user);
}

async function handleUpdateUser(params: { id: string }, request: Request) {
  const user = users.get(params.id);
  if (!user) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(user);
  }

  if (typeof body === "object" && body !== null) {
    const updates = body as Record<string, unknown>;
    if (typeof updates.name === "string") {
      user.name = updates.name;
    }
    if (typeof updates.email === "string") {
      user.email = updates.email;
    }
  }

  return Response.json(user);
}

function handleDeleteUser(params: { id: string }) {
  const existed = users.delete(params.id);
  if (!existed) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },

  // API routes
  route("/api/users", {
    get: handleGetUsers,
    post: ({ request }) => handleCreateUser(request),
  }),

  route("/api/users/:id", {
    get: ({ params }) => handleGetUser(params),
    put: ({ params, request }) => handleUpdateUser(params, request),
    delete: ({ params }) => handleDeleteUser(params),
  }),

  // Page routes
  render(Document, [route("/", Home)]),
]);