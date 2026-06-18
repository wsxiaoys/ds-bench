import { api } from "encore.dev/api";
import { Topic, Subscription } from "encore.dev/pubsub";
import { SQLDatabase } from "encore.dev/storage/sqldb";

export interface Site {
  id: number;
  url: string;
  is_up: boolean;
}

const db = new SQLDatabase("monitor", {
  migrations: "./migrations",
});

const siteChecks = new Topic<Site>("site-checks", {
  deliveryGuarantee: "at-least-once",
});

export const addSite = api(
  { method: "POST", path: "/site" },
  async (req: { url: string }): Promise<Site> => {
    const row = await db.queryRow<Site>`
      INSERT INTO sites (url, is_up)
      VALUES (${req.url}, false)
      RETURNING id, url, is_up
    `;

    if (!row) {
      throw new Error("failed to insert site");
    }

    return row;
  }
);

export const listSites = api(
  { method: "GET", path: "/site" },
  async (): Promise<{ sites: Site[] }> => {
    const sites = await db.query<Site>`
      SELECT id, url, is_up
      FROM sites
      ORDER BY id
    `;

    return { sites };
  }
);

export const triggerCheck = api(
  { method: "POST", path: "/check" },
  async (): Promise<{ queued: number }> => {
    const sites = await db.query<Site>`
      SELECT id, url, is_up
      FROM sites
    `;

    await Promise.all(sites.map((site) => siteChecks.publish(site)));

    return { queued: sites.length };
  }
);

new Subscription(siteChecks, "check-site", {
  handler: async (site: Site) => {
    let isUp = false;

    try {
      const response = await fetch(site.url, { method: "GET" });
      isUp = response.ok;
    } catch (error) {
      isUp = false;
    }

    await db.exec`
      UPDATE sites
      SET is_up = ${isUp}
      WHERE id = ${site.id}
    `;
  },
});
