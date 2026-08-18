import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { SyncedStateServer as BaseSyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { NotificationsPage } from "@/app/pages/notifications";

export class SyncedStateServer extends BaseSyncedStateServer {
  private loaded = false;

  constructor(state: any, env: any) {
    super(state, env);
  }

  override async fetch(request: Request) {
    if (!this.loaded) {
      try {
        const stored = await this.ctx.storage.list();
        for (const [k, v] of stored.entries()) {
          if (k.startsWith("state:")) {
            const key = k.slice(6);
            super.setState(v, key);
          }
        }
      } catch (err) {
        console.error("Error loading persisted state:", err);
      }
      this.loaded = true;
    }
    return super.fetch(request);
  }

  override setState(value: any, key: string) {
    super.setState(value, key);
    this.ctx.storage.put("state:" + key, value).catch((err: any) => {
      console.error("Error saving state:", err);
    });
  }
}

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/notifications", NotificationsPage),
    ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER as any),
  ]),
]);
