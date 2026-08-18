import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { SyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { NotificationsPage } from "@/app/pages/notifications";

export type AppContext = {};

// Register SyncedStateServer state handlers for D1 persistence
const loadingKeys = new Set<string>();

SyncedStateServer.registerSetStateHandler((key, value, _stub) => {
  if (env.DB) {
    env.DB.prepare(
      "INSERT INTO synced_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?"
    )
      .bind(key, JSON.stringify(value), JSON.stringify(value))
      .run()
      .catch((err) => {
        console.error("Error saving state to D1:", err);
      });
  }
});

SyncedStateServer.registerGetStateHandler((key, value, stub) => {
  if (value === undefined && !loadingKeys.has(key) && env.DB) {
    loadingKeys.add(key);
    env.DB.prepare("SELECT value FROM synced_state WHERE key = ?")
      .bind(key)
      .first<{ value: string }>()
      .then((row) => {
        if (row && row.value) {
          const parsed = JSON.parse(row.value);
          void stub.setState(parsed, key);
        }
        loadingKeys.delete(key);
      })
      .catch((err) => {
        console.error("Error loading state from D1:", err);
        loadingKeys.delete(key);
      });
  }
});

export { SyncedStateServer };

export default defineApp([
  setCommonHeaders(),
  async ({ ctx }) => {
    // Initialize D1 table if it doesn't exist
    if (env.DB) {
      try {
        await env.DB.exec(`
          CREATE TABLE IF NOT EXISTS synced_state (
            key TEXT PRIMARY KEY,
            value TEXT
          );
        `);
      } catch (err) {
        console.error("Failed to initialize database table:", err);
      }
    }
  },
  ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER as any),
  render(Document, [
    route("/", Home),
    route("/notifications", NotificationsPage),
  ]),
]);
