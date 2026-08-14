import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { count, asc, eq } from "drizzle-orm";
import { users } from "../db/schema";
import { RequestInfo } from "rwsdk/worker";

export const getApiUsers = async ({ request }: RequestInfo) => {
  const db = drizzle(env.DB);

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  let limit = 10;
  if (limitParam !== null) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      limit = parsed;
    }
  }

  let offset = 0;
  if (offsetParam !== null) {
    const parsed = parseInt(offsetParam, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  // Get total count
  const [totalResult] = await db.select({ value: count() }).from(users);
  const total = totalResult?.value ?? 0;

  // Get paginated users
  const usersList = await db.select()
    .from(users)
    .orderBy(asc(users.id))
    .limit(limit)
    .offset(offset);

  return Response.json({
    users: usersList,
    total,
    limit,
    offset,
  });
};

export const postApiUsers = async ({ request }: RequestInfo) => {
  const db = drizzle(env.DB);

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { name, email } = body || {};
  const nameVal = typeof name === "string" ? name.trim() : "";
  const emailVal = typeof email === "string" ? email.trim() : "";

  if (!nameVal || !emailVal) {
    return new Response(JSON.stringify({ error: "Name and email are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if email already exists
  const existing = await db.select()
    .from(users)
    .where(eq(users.email, emailVal))
    .limit(1);

  if (existing.length > 0) {
    return new Response(JSON.stringify({ error: "Email already exists" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const [newUser] = await db.insert(users)
      .values({
        name: nameVal,
        email: emailVal,
      })
      .returning();

    return Response.json(newUser, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes("UNIQUE") || error?.message?.includes("unique")) {
      return new Response(JSON.stringify({ error: "Email already exists" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: error?.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
