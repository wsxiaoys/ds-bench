import { api, APIError } from "encore.dev";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { checkTopic } from "./events";
import { db } from "./db";

interface AddSiteRequest {
  url: string;
}

interface Site {
  id: number;
  url: string;
  is_up: boolean;
}

interface ListSitesResponse {
  sites: Site[];
}

// POST /site
export const addSite = api(
  { method: "POST", path: "/site", expose: true },
  async (req: AddSiteRequest): Promise<Site> => {
    if (!req.url || typeof req.url !== "string") {
      throw APIError.invalidArgument("url is required");
    }
    const row = await db.queryRow<Site>`
      INSERT INTO sites (url, is_up)
      VALUES (${req.url}, FALSE)
      RETURNING id, url, is_up
    `;
    if (!row) {
      throw APIError.internal("failed to insert site");
    }
    return row;
  },
);

// GET /site
export const listSites = api(
  { method: "GET", path: "/site", expose: true },
  async (): Promise<ListSitesResponse> => {
    const rows: Site[] = [];
    for await (const row of db.query<Site>`SELECT id, url, is_up FROM sites ORDER BY id`) {
      rows.push(row);
    }
    return { sites: rows };
  },
);

// POST /check
export const triggerCheck = api(
  { method: "POST", path: "/check", expose: true },
  async (): Promise<{ ok: boolean }> => {
    for await (const row of db.query<Site>`SELECT id, url FROM sites`) {
      await checkTopic.publish({ siteId: row.id, url: row.url });
    }
    return { ok: true };
  },
);

