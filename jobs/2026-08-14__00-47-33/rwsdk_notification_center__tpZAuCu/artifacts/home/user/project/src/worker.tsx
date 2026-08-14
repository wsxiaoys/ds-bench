import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { SyncedStateServer as BaseSyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { NotificationsPage } from "@/app/pages/notifications";

export type AppContext = {};

// Keep a map of active DurableObjectState instances by their ID string.
const instances = new Map<string, DurableObjectState>();

export class SyncedStateServer extends BaseSyncedStateServer {
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    instances.set(state.id.toString(), state);
  }
}

// Persist state to Durable Object storage on set
SyncedStateServer.registerSetStateHandler(async (key, value, stub) => {
  const state = instances.get(stub.id.toString());
  if (state) {
    await state.storage.put(`state:${key}`, value);
  }
});

// Load state from Durable Object storage on get
SyncedStateServer.registerGetStateHandler(async (key, value, stub) => {
  if (value === undefined) {
    const state = instances.get(stub.id.toString());
    if (state) {
      const persistedValue = await state.storage.get(`state:${key}`);
      if (persistedValue !== undefined) {
        await (stub as any).setState(persistedValue, key);
      }
    }
  }
});

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  ...syncedStateRoutes((env) => env.SYNCED_STATE_SERVER as any),
  render(Document, [
    route("/", Home),
    route("/notifications", NotificationsPage),
  ]),
]);
