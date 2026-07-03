import { api } from "encore.dev/api";

import { db } from "./db";
import { checkSite } from "./topics";

// ---------- POST /site ----------

export interface AddSiteParams {
  url: string;
}

export interface SiteResponse {
  id: number;
  url: string;
  is_up: boolean;
}

// Add a new website to monitor and return its initial state.
export const addSite = api(
  { method: "POST", path: "/site", expose: true },
  async (params: AddSiteParams): Promise<SiteResponse> => {
    const row = await db.queryRow<SiteResponse>`
      INSERT INTO sites (url, is_up)
      VALUES (${params.url}, false)
      RETURNING id, url, is_up
    `;

    if (!row) {
      throw new Error("failed to insert site");
    }

    return row;
  },
);

// ---------- GET /site ----------

export interface ListSitesResponse {
  sites: SiteResponse[];
}

// List all monitored websites and their current status.
export const listSites = api(
  { method: "GET", path: "/site", expose: true },
  async (): Promise<ListSitesResponse> => {
    const rows = db.query<SiteResponse>`SELECT id, url, is_up FROM sites ORDER BY id`;
    const sites: SiteResponse[] = [];
    for await (const row of rows) {
      sites.push(row);
    }
    return { sites };
  },
);

// ---------- POST /check ----------

export interface CheckResponse {
  message: string;
  triggered: number;
}

// Manually trigger a check for all monitored websites by publishing
// a check event for each site to the Pub/Sub topic.
export const checkAll = api(
  { method: "POST", path: "/check", expose: true },
  async (): Promise<CheckResponse> => {
    const rows = db.query<SiteResponse>`SELECT id, url FROM sites`;
    let count = 0;
    for await (const row of rows) {
      await checkSite.publish({ id: row.id, url: row.url });
      count++;
    }
    return {
      message: `Triggered check for ${count} site(s)`,
      triggered: count,
    };
  },
);