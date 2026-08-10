import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import {
  SyncedStateServer,
  syncedStateRoutes,
} from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { AuctionPage } from "@/app/pages/auction/AuctionPage";
import { AuctionRoom } from "@/durableObjects/auctionRoom";

// Durable Objects must be exported from the worker entry module so Cloudflare
// (and wrangler's local emulation) can find them.
export { SyncedStateServer, AuctionRoom };

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Wires up the realtime (`useSyncedState`) transport routes.
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
  render(Document, [
    route("/", Home),
    route("/auction/:itemId", AuctionPage),
  ]),
]);
