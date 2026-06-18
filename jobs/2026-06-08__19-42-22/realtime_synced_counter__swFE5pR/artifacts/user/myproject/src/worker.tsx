import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { SyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export { SyncedStateServer };

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  ...syncedStateRoutes((e) => e.SYNCED_STATE as DurableObjectNamespace<SyncedStateServer>),
  route("/api/count", async () => {
    const roomId = (env.ZEALT_RUN_ID as string) || "default";
    const namespace = env.SYNCED_STATE as DurableObjectNamespace<SyncedStateServer>;
    const id = namespace.idFromName(roomId);
    const stub = namespace.get(id);
    const count = (await stub.getState("count")) || 0;
    
    return new Response(JSON.stringify({ count }), {
      headers: { "Content-Type": "application/json" }
    });
  }),
  render(Document, [route("/", Home)]),
]);
