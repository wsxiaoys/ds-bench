import { api, APIError } from "encore.dev/api";
import { Topic, Subscription } from "encore.dev/pubsub";
import { siteDB, Site } from "./db";

// ---------------------------------------------------------------------------
// Pub/Sub topic for triggering site checks
// ---------------------------------------------------------------------------

interface CheckMessage {
  siteId: number;
  url: string;
}

// Encore REDACTEDmatically provisions and manages this Pub/Sub topic.
export const checkTopic = new Topic<CheckMessage>("check-site", {
  deliveryGuarantee: "at-least-once",
});

// ---------------------------------------------------------------------------
// Pub/Sub subscriber: performs an HTTP GET to the site URL and updates status
// ---------------------------------------------------------------------------

export const checkSubscription = new Subscription(
  checkTopic,
  "check-subscriber",
  {
    handler: async (msg: CheckMessage) => {
      let isUp = false;
      try {
        const resp = await fetch(msg.url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        isUp = resp.status >= 200 && resp.status <= 299;
      } catch {
        isUp = false;
      }

      await siteDB.query`
        UPDATE sites SET is_up = ${isUp} WHERE id = ${msg.siteId}
      `;
    },
  }
);

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------

// Add a new website to monitor.
export const addSite = api(
  { method: "POST", path: "/site", expose: true },
  async ({ url }: { url: string }): Promise<Site> => {
    if (!url) {
      throw APIError.invalidArgument("url is required");
    }

    const row = await siteDB.queryRow`
      INSERT INTO sites (url, is_up)
      VALUES (${url}, false)
      RETURNING id, url, is_up
    `;

    return {
      id: Number(row!.id),
      url: row!.url as string,
      is_up: row!.is_up as boolean,
    };
  }
);

// List all monitored websites and their current status.
export const listSites = api(
  { method: "GET", path: "/site", expose: true },
  async (): Promise<{ sites: Site[] }> => {
    const rows = await siteDB.query`
      SELECT id, url, is_up FROM sites ORDER BY id
    `;

    const sites: Site[] = [];
    for await (const row of rows) {
      sites.push({
        id: Number(row.id),
        url: row.url as string,
        is_up: row.is_up as boolean,
      });
    }

    return { sites };
  }
);

// Manually trigger a check for all monitored websites.
// Publishes a message per site to the Pub/Sub topic and returns 202.
export const checkAll = api(
  { method: "POST", path: "/check", expose: true },
  async (): Promise<{ published: number }> => {
    const rows = await siteDB.query`
      SELECT id, url FROM sites
    `;

    let count = 0;
    for await (const row of rows) {
      await checkTopic.publish({
        siteId: Number(row.id),
        url: row.url as string,
      });
      count++;
    }

    return { published: count };
  }
);