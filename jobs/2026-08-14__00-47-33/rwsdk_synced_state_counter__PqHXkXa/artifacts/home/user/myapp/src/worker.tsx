import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { syncedStateRoutes } from "rwsdk/use-synced-state/worker";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { CounterPage } from "@/app/pages/counter";
import { Home } from "@/app/pages/home";

export { SyncedStateServer } from "rwsdk/use-synced-state/worker";

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
    route("/counter", CounterPage),
  ]),
]);
