import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Topic, Subscription } from "encore.dev/pubsub";

// Define the database
const db = new SQLDatabase("monitor", {
  migrations: "./migrations",
});

// Define the Pub/Sub topic
export interface CheckSiteEvent {
  id: number;
  url: string;
}

export const checkSiteTopic = new Topic<CheckSiteEvent>("check-site", {
  deliveryGuarantee: "at-least-once",
});

// Define the API models
export interface Site {
  id: number;
  url: string;
  is_up: boolean;
}

export interface AddSiteRequest {
  url: string;
}

export interface ListSitesResponse {
  sites: Site[];
}

// POST /site: Add a new website to monitor
export const addSite = api(
  { expose: true, method: "POST", path: "/site" },
  async (req: AddSiteRequest): Promise<Site> => {
    const row = await db.queryRow`
      INSERT INTO sites (url, is_up)
      VALUES (${req.url}, false)
      RETURNING id, url, is_up
    `;
    if (!row) throw new Error("Could not add site");
    return { id: row.id, url: row.url, is_up: row.is_up };
  }
);

// GET /site: List all monitored websites and their current status
export const listSites = api(
  { expose: true, method: "GET", path: "/site" },
  async (): Promise<ListSitesResponse> => {
    const rows = await db.query`
      SELECT id, url, is_up FROM sites
    `;
    const sites: Site[] = [];
    for await (const row of rows) {
      sites.push({ id: row.id, url: row.url, is_up: row.is_up });
    }
    return { sites };
  }
);

// POST /check: Manually trigger a check for all monitored websites
export const checkSites = api(
  { expose: true, method: "POST", path: "/check" },
  async (): Promise<void> => {
    const rows = await db.query`
      SELECT id, url FROM sites
    `;
    for await (const row of rows) {
      await checkSiteTopic.publish({ id: row.id, url: row.url });
    }
  }
);

// Subscriber to check the site and update status
const checkSiteSub = new Subscription(checkSiteTopic, "check-site-sub", {
  handler: async (event: CheckSiteEvent) => {
    let isUp = false;
    try {
      const resp = await fetch(event.url, { method: "GET" });
      if (resp.status >= 200 && resp.status < 300) {
        isUp = true;
      }
    } catch (err) {
      isUp = false;
    }

    await db.exec`
      UPDATE sites
      SET is_up = ${isUp}
      WHERE id = ${event.id}
    `;
  },
});
