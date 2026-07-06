import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { syncedStateRoutes } from "rwsdk/use-synced-state/worker";

// Re-export the SyncedStateServer Durable Object class so Cloudflare can find it.
export { SyncedStateServer } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { CounterPage } from "@/app/pages/counter";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Register the synced state routes that forward to the SyncedStateServer Durable Object
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
  render(Document, [route("/", Home), route("/counter", CounterPage)]),
]);