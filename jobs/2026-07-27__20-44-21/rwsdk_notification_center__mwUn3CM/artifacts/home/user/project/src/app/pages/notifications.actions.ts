"use server";

import { env } from "cloudflare:workers";

export interface Notification {
  id: string;
  severity: "info" | "warning" | "error";
  read: boolean;
  createdAt: number;
}

export async function emitNotificationServer(severity: "info" | "warning" | "error") {
  const id = env.SYNCED_STATE_SERVER.idFromName("syncedState");
  const stub = env.SYNCED_STATE_SERVER.get(id);

  const current = (await stub.getState("notifications")) as Notification[] | undefined;
  const list = current || [];

  const newNotif: Notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    severity,
    read: false,
    createdAt: Date.now(),
  };

  // Newest first inside the list container
  const updated = [newNotif, ...list];
  await stub.setState(updated, "notifications");
}

export async function markAllReadServer() {
  const id = env.SYNCED_STATE_SERVER.idFromName("syncedState");
  const stub = env.SYNCED_STATE_SERVER.get(id);

  const current = (await stub.getState("notifications")) as Notification[] | undefined;
  const list = current || [];

  const updated = list.map((n) => ({ ...n, read: true }));
  await stub.setState(updated, "notifications");
}

export async function markReadServer(notifId: string) {
  const id = env.SYNCED_STATE_SERVER.idFromName("syncedState");
  const stub = env.SYNCED_STATE_SERVER.get(id);

  const current = (await stub.getState("notifications")) as Notification[] | undefined;
  const list = current || [];

  const updated = list.map((n) => (n.id === notifId ? { ...n, read: true } : n));
  await stub.setState(updated, "notifications");
}
