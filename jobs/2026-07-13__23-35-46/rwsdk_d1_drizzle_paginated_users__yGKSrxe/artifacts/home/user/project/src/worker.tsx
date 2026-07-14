import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { count, asc, eq } from "drizzle-orm";
import * as schema from "./db/schema";

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
        const db = drizzle((env as any).DB, { schema });
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

        const totalResult = await db.select({ count: count() }).from(schema.users);
        const total = totalResult[0]?.count ?? 0;

        const usersList = await db.select()
          .from(schema.users)
          .orderBy(asc(schema.users.id))
          .limit(limit)
          .offset(offset);

        return Response.json({
          users: usersList,
          total,
          limit,
          offset,
        }, { status: 200 });
      } catch (error: any) {
        return Response.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
      }
    },
    post: async ({ request }) => {
      try {
        const db = drizzle((env as any).DB, { schema });
        let body: any;
        try {
          body = await request.json();
        } catch (e) {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const name = body?.name;
        const email = body?.email;

        if (typeof name !== "string" || name.trim() === "" || typeof email !== "string" || email.trim() === "") {
          return Response.json({ error: "Missing or empty name or email" }, { status: 400 });
        }

        const trimmedName = name.trim();
        const trimmedEmail = email.trim();

        // Pre-check for existing email to return friendly error and avoid constraint violations
        const existing = await db.select()
          .from(schema.users)
          .where(eq(schema.users.email, trimmedEmail));

        if (existing.length > 0) {
          return Response.json({ error: "User with this email already exists" }, { status: 409 });
        }

        const inserted = await db.insert(schema.users)
          .values({
            name: trimmedName,
            email: trimmedEmail,
          })
          .returning();

        if (inserted.length === 0) {
          return Response.json({ error: "Failed to create user" }, { status: 500 });
        }

        return Response.json(inserted[0], { status: 201 });
      } catch (error: any) {
        if (error?.message?.includes("UNIQUE") || error?.message?.includes("constraint")) {
          return Response.json({ error: "User with this email already exists" }, { status: 409 });
        }
        return Response.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
      }
    }
  }),
  render(Document, [route("/", Home)]),
]);
