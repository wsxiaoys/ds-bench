import { env } from "cloudflare:workers";
import { lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

import { records } from "@/db/schema";

// Drizzle client type for our D1 binding.
type DB = ReturnType<typeof drizzle<{ records: typeof records }>>;

const app = defineApp([
  setCommonHeaders(),
  render(Document, [route("/", Home)]),
  route("/api/records", {
    // GET /api/records — list every record currently in the database.
    get: async () => {
      const db: DB = drizzle(env.DB, { schema: { records } });
      const rows = await db.select().from(records).all();
      return Response.json(
        rows.map((r) => ({
          id: r.id,
          label: r.label,
          expiresAt: r.expiresAt,
        })),
      );
    },
    // POST /api/records — create a record { label: string, expiresAt: number }.
    post: async ({ request }) => {
      const db: DB = drizzle(env.DB, { schema: { records } });

      let body: { label?: unknown; expiresAt?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }

      const label = typeof body.label === "string" ? body.label : null;
      const expiresAt =
        typeof body.expiresAt === "number" && Number.isFinite(body.expiresAt)
          ? Math.trunc(body.expiresAt)
          : null;

      if (label === null || expiresAt === null) {
        return Response.json(
          {
            error: "`label` (string) and `expiresAt` (number) are required",
          },
          { status: 400 },
        );
      }

      const id = crypto.randomUUID();

      await db.insert(records).values({ id, label, expiresAt });

      return Response.json({ id, label, expiresAt }, { status: 201 });
    },
  }),
]);

// ---------------------------------------------------------------------------
// Default export: an ExportedHandler that wires the HTTP app to `fetch`
// and adds the cron-triggered cleanup handler to `scheduled`. The cron
// handler builds its own Drizzle client from env.DB because it runs outside
// any HTTP request context.
// ---------------------------------------------------------------------------
export default {
  fetch: app.fetch,

  async scheduled(
    controller: ScheduledController,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    if (controller.cron !== "0 * * * *") return;

    const db: DB = drizzle(env.DB, { schema: { records } });
    // A record is expired when expiresAt <= now (millisecond timestamp).
    await db.delete(records).where(lte(records.expiresAt, Date.now()));
  },
} satisfies ExportedHandler<Env, unknown>;
