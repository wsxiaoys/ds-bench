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

export type AppContext = {};

// Export the Durable Object so Cloudflare can find it on the worker isolate.
export { SyncedStateServer };

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Register the realtime (useSyncedState) routes backed by the
  // SyncedStateServer Durable Object. The default base path is
  // "/__synced-state"; requests are forwarded to the DO namespace.
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
  render(Document, [route("/", Home)]),
]);
