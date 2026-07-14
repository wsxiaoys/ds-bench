import { lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { records } from "./db/schema";

export type AppContext = {};

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/records", {
    get: async () => {
      try {
        const db = drizzle(env.DB, { schema: { records } });
        const allRecords = await db.select().from(records);
        return Response.json(allRecords, { status: 200 });
      } catch (error) {
        console.error("GET /api/records error:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
      }
    },
    post: async ({ request }) => {
      try {
        const body = (await request.json()) as { label: string; expiresAt: number };
        if (!body || typeof body.label !== "string" || typeof body.expiresAt !== "number") {
          return Response.json({ error: "Invalid body parameters" }, { status: 400 });
        }
        const id = crypto.randomUUID();
        const db = drizzle(env.DB, { schema: { records } });
        await db.insert(records).values({
          id,
          label: body.label,
          expiresAt: body.expiresAt,
        });
        return Response.json({ id, label: body.label, expiresAt: body.expiresAt }, { status: 201 });
      } catch (error) {
        console.error("POST /api/records error:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
      }
    },
  }),
  render(Document, [route("/", Home)]),
]);

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    console.log(`Cron triggered with schedule: ${controller.cron}`);
    if (controller.cron === "0 * * * *") {
      try {
        const db = drizzle(env.DB, { schema: { records } });
        const now = Date.now();
        await db.delete(records).where(lte(records.expiresAt, now));
        console.log(`Successfully swept expired records up to ${now}`);
      } catch (error) {
        console.error("Scheduled cron cleanup error:", error);
      }
    } else {
      console.log(`Skipping cron cleanup for unmatched schedule: ${controller.cron}`);
    }
  },
};
