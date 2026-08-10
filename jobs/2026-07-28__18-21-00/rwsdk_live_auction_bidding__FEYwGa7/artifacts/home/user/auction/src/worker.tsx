import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { syncedStateRoutes } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { AuctionRoomPage } from "@/app/pages/auction";

// Export Durable Objects
export { AuctionRoomServer as SyncedStateServer } from "@/app/auctionServer";
export { DbServer } from "@/app/db";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  ...syncedStateRoutes((env) => env.SYNCED_STATE_SERVER),
  render(Document, [
    route("/", Home),
    route("/auction/:itemId", AuctionRoomPage),
  ]),
]);
