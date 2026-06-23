import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Topic, Subscription } from "encore.dev/pubsub";
import { api } from "encore.dev/api";

const db = new SQLDatabase("monitor-db", {
  migrations: "./migrations",
});

interface Site {
  id: number;
  url: string;
  is_up: boolean;
}

interface CheckMessage {
  site_id: number;
  url: string;
}

// Pub/Sub topic for site checks
const checkTopic = new Topic<CheckMessage>("site-check", {
  deliveryGuarantee: "at-least-once",
});

// POST /site - Add a new website to monitor
export const addSite = api(
  { method: "POST", path: "/site", expose: true },
  async ({ url }: { url: string }): Promise<Site> => {
    const row = await db.queryRow`
      INSERT INTO sites (url, is_up) VALUES (${url}, FALSE)
      RETURNING id, url, is_up
    `;
    if (!row) {
      throw new Error("Failed to insert site");
    }
    return {
      id: row.id,
      url: row.url,
      is_up: row.is_up,
    };
  }
);

// GET /site - List all monitored websites
export const listSites = api(
  { method: "GET", path: "/site", expose: true },
  async (): Promise<{ sites: Site[] }> => {
    const rows = db.query("SELECT id, url, is_up FROM sites ORDER BY id");
    const sites: Site[] = [];
    for await (const row of rows) {
      sites.push({
        id: row.id,
        url: row.url,
        is_up: row.is_up,
      });
    }
    return { sites };
  }
);

// POST /check - Trigger checks for all monitored websites
export const triggerCheck = api(
  { method: "POST", path: "/check", expose: true },
  async (): Promise<{ triggered: number }> => {
    const rows = db.query("SELECT id, url FROM sites ORDER BY id");
    let count = 0;
    for await (const row of rows) {
      await checkTopic.publish({
        site_id: row.id,
        url: row.url,
      });
      count++;
    }
    return { triggered: count };
  }
);

// Pub/Sub subscriber that performs the actual HTTP check
const checkSubscriber = new Subscription(checkTopic, "check-subscriber", {
  handler: async (msg: CheckMessage) => {
    let isUp = false;
    try {
      const response = await fetch(msg.url, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      isUp = response.status >= 200 && response.status < 300;
    } catch {
      isUp = false;
    }

    await db.exec`
      UPDATE sites SET is_up = ${isUp} WHERE id = ${msg.site_id}
    `;
  },
});