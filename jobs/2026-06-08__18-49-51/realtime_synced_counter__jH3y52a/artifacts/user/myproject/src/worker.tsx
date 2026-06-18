import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import {
  SyncedStateServer,
  syncedStateRoutes,
} from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export { SyncedStateServer };

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    ctx;
  },
  ...syncedStateRoutes((e) => (e as any).SYNCED_STATE),
  route("/api/count", async () => {
    const namespace = (env as any).SYNCED_STATE as DurableObjectNamespace<SyncedStateServer>;
    const roomId = (env as any).ZEALT_RUN_ID as string ?? "default";
    const id = namespace.idFromName(roomId);
    const stub = namespace.get(id);
    const count = await stub.getState("count");
    return new Response(JSON.stringify({ count: count ?? 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
  render(Document, [route("/", Home)]),
]);
