// This file was bundled by Encore v1.57.9
//
// https://encore.dev

// encore.gen/internal/entrypoints/combined/main.ts
import { registerGateways, registerHandlers, run } from "encore.dev/internal/codegen/appinit";

// monitor/monitor.ts
import { api, APIError } from "encore.dev/api";
import { Topic, Subscription } from "encore.dev/pubsub";

// monitor/db.ts
import { SQLDatabase } from "encore.dev/storage/sqldb";
var siteDB = new SQLDatabase("site-db", {
  migrations: "./migrations"
});

// monitor/monitor.ts
var checkTopic = new Topic("check-site", {
  deliveryGuarantee: "at-least-once"
});
var checkSubscription = new Subscription(
  checkTopic,
  "check-subscriber",
  {
    handler: async (msg) => {
      let isUp = false;
      try {
        const resp = await fetch(msg.url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(15e3)
        });
        isUp = resp.status >= 200 && resp.status <= 299;
      } catch {
        isUp = false;
      }
      await siteDB.query`
        UPDATE sites SET is_up = ${isUp} WHERE id = ${msg.siteId}
      `;
    }
  }
);
var addSite = api(
  { method: "POST", path: "/site" },
  async ({ url }) => {
    if (!url) {
      throw APIError.invalidArgument("url is required");
    }
    const row = await siteDB.queryRow`
      INSERT INTO sites (url, is_up)
      VALUES (${url}, false)
      RETURNING id, url, is_up
    `;
    return {
      id: Number(row.id),
      url: row.url,
      is_up: row.is_up
    };
  }
);
var listSites = api(
  { method: "GET", path: "/site" },
  async () => {
    const rows = await siteDB.query`
      SELECT id, url, is_up FROM sites ORDER BY id
    `;
    const sites = [];
    for await (const row of rows) {
      sites.push({
        id: Number(row.id),
        url: row.url,
        is_up: row.is_up
      });
    }
    return { sites };
  }
);
var checkAll = api(
  { method: "POST", path: "/check" },
  async () => {
    const rows = await siteDB.query`
      SELECT id, url FROM sites
    `;
    let count = 0;
    for await (const row of rows) {
      await checkTopic.publish({
        siteId: Number(row.id),
        url: row.url
      });
      count++;
    }
    return { published: count };
  }
);

// encore.gen/internal/entrypoints/combined/main.ts
var gateways = [];
var handlers = [
  {
    apiRoute: {
      service: "monitor",
      name: "addSite",
      handler: addSite,
      raw: false,
      streamingRequest: false,
      streamingResponse: false
    },
    endpointOptions: { "expose": false, "auth": false, "isRaw": false, "isStream": false, "tags": [] },
    middlewares: []
  },
  {
    apiRoute: {
      service: "monitor",
      name: "listSites",
      handler: listSites,
      raw: false,
      streamingRequest: false,
      streamingResponse: false
    },
    endpointOptions: { "expose": false, "auth": false, "isRaw": false, "isStream": false, "tags": [] },
    middlewares: []
  },
  {
    apiRoute: {
      service: "monitor",
      name: "checkAll",
      handler: checkAll,
      raw: false,
      streamingRequest: false,
      streamingResponse: false
    },
    endpointOptions: { "expose": false, "auth": false, "isRaw": false, "isStream": false, "tags": [] },
    middlewares: []
  }
];
registerGateways(gateways);
registerHandlers(handlers);
await run(import.meta.url);
//# sourceMappingURL=main.mjs.map
