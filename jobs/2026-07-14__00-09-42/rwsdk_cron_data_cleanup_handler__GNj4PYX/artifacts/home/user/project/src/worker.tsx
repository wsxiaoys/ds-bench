import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { lte } from "drizzle-orm";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { createDb, schema } from "@/db";

export type AppContext = {};

// ─── Helper ────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

// ─── HTTP Application ───────────────────────────────────────────────────────

const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },

  // POST /api/records — create a record
  route("POST /api/records", async ({ request }) => {
    let body: { label?: unknown; expiresAt?: unknown };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { label, expiresAt } = body as {
      label?: string;
      expiresAt?: number;
    };

    if (typeof label !== "string" || !label) {
      return new Response(
        JSON.stringify({ error: "label is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (typeof expiresAt !== "number") {
      return new Response(
        JSON.stringify({
          error: "expiresAt is required and must be a number (ms timestamp)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = createDb(env.DB);
    const id = generateId();

    await db
      .insert(schema.records)
      .values({ id, label, expiresAt });

    const created = { id, label, expiresAt };
    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }),

  // GET /api/records — list all records
  route("GET /api/records", async () => {
    const db = createDb(env.DB);
    const rows = await db.select().from(schema.records);
    const result = rows.map((r) => ({
      id: r.id,
      label: r.label,
      expiresAt: r.expiresAt,
    }));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),

  render(Document, [route("/", Home)]),
]);

// ─── Exports ────────────────────────────────────────────────────────────────

export default {
  // HTTP traffic is forwarded to the defineApp fetch handler
  fetch: app.fetch,

  // Cron trigger handler
  async scheduled(controller: ScheduledController) {
    if (controller.cron === "0 * * * *") {
      const db = createDb(env.DB);
      const now = Date.now();
      await db
        .delete(schema.records)
        .where(lte(schema.records.expiresAt, now));
    }
  },
} satisfies ExportedHandler<Env>;
