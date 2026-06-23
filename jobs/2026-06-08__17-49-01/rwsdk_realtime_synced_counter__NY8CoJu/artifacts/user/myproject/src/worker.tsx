import { env } from "cloudflare:workers";
import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { syncedStateRoutes } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export { SyncedStateServer } from "rwsdk/use-synced-state/worker";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/api/count", async () => {
    const namespace = (env as any).SYNCED_STATE_SERVER;
    const roomId = (env as any).ZEALT_RUN_ID || "default";
    const id = namespace.idFromName(roomId);
    const stub = namespace.get(id);
    const count = (await stub.getState("count")) ?? 0;
    return Response.json({ count });
  }),
  route("/api/increment", async () => {
    const namespace = (env as any).SYNCED_STATE_SERVER;
    const roomId = (env as any).ZEALT_RUN_ID || "default";
    const id = namespace.idFromName(roomId);
    const stub = namespace.get(id);
    const count = (await stub.getState("count")) ?? 0;
    const newCount = count + 1;
    await stub.setState(newCount, "count");
    return Response.json({ count: newCount });
  }),
  route("/api/decrement", async () => {
    const namespace = (env as any).SYNCED_STATE_SERVER;
    const roomId = (env as any).ZEALT_RUN_ID || "default";
    const id = namespace.idFromName(roomId);
    const stub = namespace.get(id);
    const count = (await stub.getState("count")) ?? 0;
    const newCount = count - 1;
    await stub.setState(newCount, "count");
    return Response.json({ count: newCount });
  }),
  ...syncedStateRoutes((env) => (env as any).SYNCED_STATE_SERVER),
  render(Document, [route("/", Home)]),
]);
