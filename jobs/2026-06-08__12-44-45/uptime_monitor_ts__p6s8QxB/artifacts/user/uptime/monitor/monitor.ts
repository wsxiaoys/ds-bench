import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Topic, Subscription } from "encore.dev/pubsub";

// Define the database
const db = new SQLDatabase("monitor", {
  migrations: "./migrations",
});

// Define the Pub/Sub topic
export interface SiteCheckEvent {
  siteID: number;
  url: string;
}

const checkTopic = new Topic<SiteCheckEvent>("check-site", {
  deliveryStrategy: {
    maxRetries: 3,
    retryDelay: "10s",
  },
});

interface Site {
  id: number;
  url: string;
  is_up: boolean;
}

interface AddSiteParams {
  url: string;
}

interface ListSitesResponse {
  sites: Site[];
}

// POST /site: Add a new website to monitor
export const addSite = api(
  { expose: true, method: "POST", path: "/site" },
  async (params: AddSiteParams): Promise<Site> => {
    const row = await db.queryRow`
      INSERT INTO site (url)
      VALUES (${params.url})
      RETURNING id, url, is_up
    `;
    if (!row) throw new Error("failed to insert site");
    return { id: row.id, url: row.url, is_up: row.is_up };
  }
);

// GET /site: List all monitored websites and their current status
export const listSites = api(
  { expose: true, method: "GET", path: "/site" },
  async (): Promise<ListSitesResponse> => {
    const rows = db.query`
      SELECT id, url, is_up
      FROM site
    `;
    const sites: Site[] = [];
    for await (const row of rows) {
      sites.push({ id: row.id, url: row.url, is_up: row.is_up });
    }
    return { sites };
  }
);

// POST /check: Manually trigger a check for all monitored websites
export const checkAll = api(
  { expose: true, method: "POST", path: "/check" },
  async (): Promise<void> => {
    const rows = db.query`
      SELECT id, url
      FROM site
    `;
    for await (const row of rows) {
      await checkTopic.publish({ siteID: row.id, url: row.url });
    }
  }
);

// Pub/Sub subscriber that performs the HTTP GET request and updates the database
const _ = new Subscription(checkTopic, "check-site-sub", {
  handler: async (event: SiteCheckEvent) => {
    let isUp = false;
    try {
      const resp = await fetch(event.url, { method: "GET" });
      isUp = resp.status >= 200 && resp.status < 300;
    } catch (err) {
      isUp = false;
    }

    await db.exec`
      UPDATE site
      SET is_up = ${isUp}
      WHERE id = ${event.siteID}
    `;
  },
});
