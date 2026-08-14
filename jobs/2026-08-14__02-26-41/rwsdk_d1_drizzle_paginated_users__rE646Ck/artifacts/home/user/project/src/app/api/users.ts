import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { users } from "@/db/schema";
import { asc, count, eq } from "drizzle-orm";

function getDB() {
  return drizzle((env as any).DB);
}

export const getUsers = async ({ request }: { request: Request }) => {
  try {
    const url = new URL(request.url);
    const limitStr = url.searchParams.get("limit");
    const offsetStr = url.searchParams.get("offset");

    let limit = 10;
    if (limitStr !== null) {
      const parsed = parseInt(limitStr, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        limit = parsed;
      }
    }

    let offset = 0;
    if (offsetStr !== null) {
      const parsed = parseInt(offsetStr, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        offset = parsed;
      }
    }

    const db = getDB();
    const paginatedUsers = await db
      .select()
      .from(users)
      .orderBy(asc(users.id))
      .limit(limit)
      .offset(offset);

    const totalResult = await db.select({ value: count() }).from(users);
    const total = totalResult[0]?.value ?? 0;

    return Response.json({
      users: paginatedUsers,
      total,
      limit,
      offset,
    }, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return Response.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
};

export const createUser = async ({ request }: { request: Request }) => {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!name || !email) {
      return Response.json({ error: "Name and email are required and cannot be empty" }, { status: 400 });
    }

    const db = getDB();

    // Check if user with same email exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return Response.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const insertResult = await db
      .insert(users)
      .values({ name, email })
      .returning();

    const newUser = insertResult[0];

    return Response.json(newUser, {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("POST /api/users error:", error);
    return Response.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
};
