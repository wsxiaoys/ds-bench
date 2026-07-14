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

// Export the Durable Object so Cloudflare can find it
export { SyncedStateServer };

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Register the synced state routes
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
  render(Document, [route("/", Home)]),
]);
