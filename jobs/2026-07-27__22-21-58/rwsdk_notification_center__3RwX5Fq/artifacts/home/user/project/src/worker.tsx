import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { SyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { NotificationsPage } from "@/app/pages/notifications/NotificationsPage";
import { NotificationsDurableObject } from "@/notifications/durableObject";

// Durable Object classes must be exported from the worker's main module so
// wrangler can bind them (see the matching `durable_objects` bindings in
// wrangler.jsonc).
export { SyncedStateServer, NotificationsDurableObject };

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Wires up the `useSyncedState` realtime transport (WebSocket/RPC routes
  // backed by the SyncedStateServer Durable Object).
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
  render(Document, [
    route("/", Home),
    route("/notifications", NotificationsPage),
  ]),
]);
