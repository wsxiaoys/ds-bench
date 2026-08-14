import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { count, eq } from "drizzle-orm";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { users } from "./db/schema";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/users", {
    get: async ({ request }) => {
      try {
        const db = drizzle(env.DB);
        const url = new URL(request.url);

        let limit = parseInt(url.searchParams.get("limit") ?? "10", 10);
        let offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

        if (isNaN(limit) || limit < 0) {
          limit = 10;
        }
        if (isNaN(offset) || offset < 0) {
          offset = 0;
        }

        // Get total count
        const [{ value: total }] = await db
          .select({ value: count() })
          .from(users);

        // Get users page
        const result = await db
          .select()
          .from(users)
          .orderBy(users.id)
          .limit(limit)
          .offset(offset);

        return Response.json({
          users: result,
          total,
          limit,
          offset,
        });
      } catch (error: any) {
        return Response.json(
          { error: error.message || "Internal Server Error" },
          { status: 500 }
        );
      }
    },
    post: async ({ request }) => {
      try {
        const db = drizzle(env.DB);

        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
          );
        }

        const { name, email } = body || {};

        if (
          !name ||
          typeof name !== "string" ||
          name.trim() === "" ||
          !email ||
          typeof email !== "string" ||
          email.trim() === ""
        ) {
          return Response.json(
            { error: "Name and email are required and cannot be empty" },
            { status: 400 }
          );
        }

        // Check if user with same email exists
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing.length > 0) {
          return Response.json(
            { error: "Email already exists" },
            { status: 409 }
          );
        }

        // Insert new user
        const [newUser] = await db
          .insert(users)
          .values({
            name: name.trim(),
            email: email.trim(),
          })
          .returning();

        return Response.json(newUser, { status: 201 });
      } catch (error: any) {
        if (
          error?.message?.includes("UNIQUE") ||
          error?.message?.includes("constraint")
        ) {
          return Response.json(
            { error: "Email already exists" },
            { status: 409 }
          );
        }
        return Response.json(
          { error: error.message || "Internal Server Error" },
          { status: 500 }
        );
      }
    },
  }),
  render(Document, [route("/", Home)]),
]);
