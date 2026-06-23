import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Topic, Subscription } from "encore.dev/pubsub";

// ── Database ──────────────────────────────────────────────────────────────────
const db = new SQLDatabase("monitor", {
  migrations: "./migrations",
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface Site {
  id: number;
  url: string;
  is_up: boolean;
}

// ── Pub/Sub topic ─────────────────────────────────────────────────────────────
interface CheckMessage {
  site_id: number;
}

export const checkTopic = new Topic<CheckMessage>("site-check", {
  deliveryGuarantee: "at-least-once",
});

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /site — add a new website to monitor.
 */
export const addSite = api(
  { method: "POST", path: "/site", expose: true },
  async (params: { url: string }): Promise<Site> => {
    const row = await db.queryRow<Site>`
      INSERT INTO sites (url, is_up)
      VALUES (${params.url}, false)
      RETURNING id, url, is_up
    `;
    return row!;
  }
);

/**
 * GET /site — list all monitored websites with their current status.
 */
export const listSites = api(
  { method: "GET", path: "/site", expose: true },
  async (): Promise<{ sites: Site[] }> => {
    const sites: Site[] = [];
    for await (const row of db.query<Site>`
      SELECT id, url, is_up FROM sites ORDER BY id
    `) {
      sites.push(row);
    }
    return { sites };
  }
);

/**
 * POST /check — trigger an asynchronous check for all monitored sites.
 */
export const checkAll = api(
  { method: "POST", path: "/check", expose: true },
  async (): Promise<{ status: string }> => {
    for await (const row of db.query<{ id: number }>`
      SELECT id FROM sites
    `) {
      await checkTopic.publish({ site_id: row.id });
    }
    return { status: "ok" };
  }
);

// ── Subscriber ────────────────────────────────────────────────────────────────

const _ = new Subscription(checkTopic, "check-site", {
  handler: async (msg: CheckMessage) => {
    // Fetch the site URL from the database.
    const site = await db.queryRow<Site>`
      SELECT id, url, is_up FROM sites WHERE id = ${msg.site_id}
    `;
    if (!site) return;

    // Perform the HTTP check.
    let isUp = false;
    try {
      const response = await fetch(site.url, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      });
      isUp = response.status >= 200 && response.status <= 299;
    } catch {
      isUp = false;
    }

    // Update the database.
    await db.exec`
      UPDATE sites SET is_up = ${isUp} WHERE id = ${msg.site_id}
    `;
  },
});
