import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Topic, Subscription } from "encore.dev/pubsub";

// Create the uptime database and assign it to the "db" variable
export const db = new SQLDatabase("uptime", {
  migrations: "./migrations",
});

export interface Site {
  id: number;
  url: string;
  is_up: boolean;
}

interface AddSiteRequest {
  url: string;
}

interface ListSitesResponse {
  sites: Site[];
}

export interface CheckEvent {
  siteID: number;
  url: string;
}

// Declares the Pub/Sub topic
export const checkTopic = new Topic<CheckEvent>("check-site", {
  deliveryGuarantee: "at-least-once",
});

// Endpoint: POST /site
export const addSite = api(
  { expose: true, method: "POST", path: "/site" },
  async (req: AddSiteRequest): Promise<Site> => {
    if (!req.url) {
      throw APIError.invalidArgument("URL is required");
    }
    const site = await db.queryRow<Site>`
      INSERT INTO site (url, is_up)
      VALUES (${req.url}, false)
      RETURNING id, url, is_up
    `;
    if (!site) {
      throw APIError.internal("Failed to insert site");
    }
    return site;
  }
);

// Endpoint: GET /site
export const listSites = api(
  { expose: true, method: "GET", path: "/site" },
  async (): Promise<ListSitesResponse> => {
    const sites = await db.queryAll<Site>`
      SELECT id, url, is_up
      FROM site
      ORDER BY id ASC
    `;
    return { sites: sites || [] };
  }
);

// Endpoint: POST /check
export const checkAll = api(
  { expose: true, method: "POST", path: "/check" },
  async (): Promise<void> => {
    const sites = await db.queryAll<Site>`
      SELECT id, url, is_up
      FROM site
    `;
    for (const site of sites) {
      await checkTopic.publish({ siteID: site.id, url: site.url });
    }
  }
);

// Pub/Sub Subscription
const _ = new Subscription(checkTopic, "perform-check", {
  handler: async (event: CheckEvent) => {
    let isUp = false;
    let targetUrl = event.url;
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const resp = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      isUp = resp.status >= 200 && resp.status <= 299;
    } catch (e) {
      isUp = false;
    }

    await db.exec`
      UPDATE site
      SET is_up = ${isUp}
      WHERE id = ${event.siteID}
    `;
  },
});
