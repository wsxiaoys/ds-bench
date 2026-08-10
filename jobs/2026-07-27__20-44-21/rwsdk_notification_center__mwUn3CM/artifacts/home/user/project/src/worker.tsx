import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { SyncedStateServer as BaseSyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { Notifications } from "@/app/pages/notifications";

export type AppContext = {};

export class SyncedStateServer extends BaseSyncedStateServer {
  static activeStorage: any = null;
  static isLoading = false;

  constructor(state: any, env: any) {
    super(state, env);
    SyncedStateServer.activeStorage = state.storage;
    state.blockConcurrencyWhile(async () => {
      SyncedStateServer.isLoading = true;
      try {
        const stored = await state.storage.list();
        for (const [key, value] of stored.entries()) {
          this.setState(value, key);
        }
      } catch (err) {
        console.error("Failed to load synced state from storage:", err);
      } finally {
        SyncedStateServer.isLoading = false;
      }
    });
  }
}

SyncedStateServer.registerSetStateHandler(async (key, value, stub) => {
  if (SyncedStateServer.isLoading) return;
  if (SyncedStateServer.activeStorage) {
    await SyncedStateServer.activeStorage.put(key, value);
  }
});

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  ...syncedStateRoutes((env) => env.SYNCED_STATE_SERVER),
  render(Document, [
    route("/", Home),
    route("/notifications", Notifications),
  ]),
]);
