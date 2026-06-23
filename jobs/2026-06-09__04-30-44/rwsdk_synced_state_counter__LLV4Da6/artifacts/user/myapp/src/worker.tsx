import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { syncedStateRoutes } from "rwsdk/use-synced-state/worker";
export { SyncedStateServer } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { Counter } from "@/app/pages/counter";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  syncedStateRoutes((env: any) => env.SYNCED_STATE_SERVER),
  render(Document, [
    route("/", Home),
    route("/counter", Counter)
  ]),
]);
