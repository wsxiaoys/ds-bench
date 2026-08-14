import { lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { db, schema } from "@/db/client";

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/api/records", {
      get: async () => {
        try {
          const allRecords = await db.select().from(schema.records).all();
          return Response.json(allRecords, { status: 200 });
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      },
      post: async ({ request }) => {
        try {
          const body = (await request.json()) as { label: string; expiresAt: number };
          if (!body || typeof body.label !== "string" || typeof body.expiresAt !== "number") {
            return Response.json({ error: "Invalid body" }, { status: 400 });
          }

          const newRecord = {
            id: crypto.randomUUID(),
            label: body.label,
            expiresAt: body.expiresAt,
          };

          await db.insert(schema.records).values(newRecord).run();

          return Response.json(newRecord, { status: 201 });
        } catch (err: any) {
          return Response.json({ error: err.message }, { status: 500 });
        }
      },
    }),
  ]),
]);

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    console.log(`[Cron Cleanup] running scheduled job for cron: ${controller.cron}`);
    const d1Db = drizzle(env.DB, { schema });
    const now = Date.now();
    try {
      const result = await d1Db
        .delete(schema.records)
        .where(lte(schema.records.expiresAt, now))
        .run();
      console.log(`[Cron Cleanup] successfully deleted expired records.`, result);
    } catch (err) {
      console.error(`[Cron Cleanup] error deleting expired records:`, err);
    }
  },
};
