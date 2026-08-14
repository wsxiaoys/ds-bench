import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { lte } from "drizzle-orm";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import * as schema from "./db/schema";

export type AppContext = {};

const db = drizzle(env.DB, { schema });

export const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", Home)]),
  route("/api/records", {
    post: async ({ request }) => {
      try {
        const { label, expiresAt } = await request.json() as { label: string; expiresAt: number };
        
        if (!label || typeof label !== "string") {
          return Response.json({ error: "label is required and must be a string" }, { status: 400 });
        }
        if (typeof expiresAt !== "number") {
          return Response.json({ error: "expiresAt is required and must be a number" }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const record = { id, label, expiresAt };
        await db.insert(schema.records).values(record);
        return Response.json(record, { status: 201 });
      } catch (error) {
        return Response.json({ error: (error as Error).message }, { status: 400 });
      }
    },
    get: async () => {
      try {
        const results = await db.select().from(schema.records);
        return Response.json(results, { status: 200 });
      } catch (error) {
        return Response.json({ error: (error as Error).message }, { status: 500 });
      }
    }
  })
]);

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (controller.cron === "0 * * * *") {
      const dbInstance = drizzle(env.DB, { schema });
      const now = Date.now();
      await dbInstance.delete(schema.records).where(lte(schema.records.expiresAt, now));
    }
  }
};
