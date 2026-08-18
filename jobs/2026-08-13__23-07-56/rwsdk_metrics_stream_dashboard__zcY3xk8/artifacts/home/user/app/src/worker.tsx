import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { syncedStateRoutes } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { MetricsPage } from "@/app/pages/metrics";
import { CustomSyncedStateServer } from "@/app/CustomSyncedStateServer";

export type AppContext = {};

// Export the Durable Object class so Wrangler can bind it
export { CustomSyncedStateServer };

export default defineApp([
  setCommonHeaders(),
  ...syncedStateRoutes((env: any) => env.syncedState),
  render(Document, [
    route("/", Home),
    route("/metrics", MetricsPage),
  ]),
]);
