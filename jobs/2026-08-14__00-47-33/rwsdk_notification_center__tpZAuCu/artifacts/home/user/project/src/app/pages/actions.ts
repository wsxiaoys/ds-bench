"use server";

import { env } from "cloudflare:workers";

interface Notification {
  id: string;
  severity: "info" | "warning" | "error";
  read: boolean;
  created_at: number;
}

export async function emitNotification(severity: "info" | "warning" | "error") {
  const id = env.SYNCED_STATE_SERVER.idFromName("global");
  const stub = env.SYNCED_STATE_SERVER.get(id) as any;

  // Get current state from DO
  const current = (await stub.getState("notifications")) as Notification[] || [];

  const newNotif: Notification = {
    id: crypto.randomUUID(),
    severity,
    read: false,
    created_at: Date.now(),
  };

  const updated = [newNotif, ...current];
  await stub.setState(updated, "notifications");
}
