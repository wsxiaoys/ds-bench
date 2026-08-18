import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { syncedStateRoutes, SyncedStateServer } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { AuctionPage } from "@/app/pages/auction";

// Export all Durable Object classes so wrangler can bind them
export { SyncedStateServer };
export { DatabaseServer } from "@/app/shared/database";
export { AuctionRoom } from "@/app/shared/auctionRoom";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
  render(Document, [
    route("/", Home),
    route("/auction/:itemId", AuctionPage),
  ]),
]);
