import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import {
  SyncedStateServer as BaseSyncedStateServer,
  syncedStateRoutes,
} from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";

export type AppContext = {
  ZEALT_RUN_ID: string;
};

// Extend SyncedStateServer to add a /getState HTTP endpoint for the API
export class SyncedStateServer extends BaseSyncedStateServer {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/getState") {
      const key = url.searchParams.get("key");
      if (key) {
        const value = this.getState(key);
        return new Response(JSON.stringify({ value }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Missing key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return super.fetch(request);
  }
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    ctx.ZEALT_RUN_ID = env.ZEALT_RUN_ID;
  },
  syncedStateRoutes((e) => e.SYNCED_STATE),
  render(Document, [
    route("/", Home),
    route("/api/count", async () => {
      const namespace = env.SYNCED_STATE;
      const roomId = env.ZEALT_RUN_ID;
      const id = namespace.idFromName(roomId);
      const stub = namespace.get(id);
      const response = await stub.fetch(
        new Request("http://internal/getState?key=counter"),
      );
      const data: { value: unknown } = await response.json();
      const count = typeof data.value === "number" ? data.value : 0;
      return new Response(JSON.stringify({ count }), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  ]),
]);