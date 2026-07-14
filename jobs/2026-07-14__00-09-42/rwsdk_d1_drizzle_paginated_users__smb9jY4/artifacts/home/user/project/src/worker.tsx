import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { drizzle } from "drizzle-orm/d1";
import { count, eq } from "drizzle-orm";
import { AsyncLocalStorage } from "node:async_hooks";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { users } from "@/db/schema";

export type AppContext = {};

// Request-scoped env storage so route handlers can access Cloudflare bindings
const envStorage = new AsyncLocalStorage<Env>();

export function getEnv(): Env {
  const env = envStorage.getStore();
  if (!env) throw new Error("env not available outside of a request context");
  return env;
}

async function getUsers(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = url.searchParams;

  const rawLimit = parseInt(params.get("limit") ?? "10", 10);
  const rawOffset = parseInt(params.get("offset") ?? "0", 10);
  const limit = isNaN(rawLimit) || rawLimit < 0 ? 10 : rawLimit;
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  const db = drizzle(getEnv().DB);

  const [rows, totalRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .orderBy(users.id)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(users),
  ]);

  const total = totalRows[0]?.total ?? 0;

  return Response.json({ users: rows, total, limit, offset }, { status: 200 });
}

async function createUser(request: Request): Promise<Response> {
  let body: { name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();

  if (!name || !email) {
    return Response.json(
      { error: "name and email are required" },
      { status: 400 },
    );
  }

  const db = drizzle(getEnv().DB);

  // Check for duplicate email before inserting
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return Response.json(
      { error: "A user with that email already exists" },
      { status: 409 },
    );
  }

  const inserted = await db
    .insert(users)
    .values({ name, email })
    .returning({ id: users.id, name: users.name, email: users.email });

  return Response.json(inserted[0], { status: 201 });
}

const app = defineApp([
  setCommonHeaders(),
  route("/api/users", {
    get: ({ request }) => getUsers(request),
    post: ({ request }) => createUser(request),
  }),
  render(Document, [route("/", Home)]),
]);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return envStorage.run(env, () => app.fetch(request, env, ctx));
  },
};
