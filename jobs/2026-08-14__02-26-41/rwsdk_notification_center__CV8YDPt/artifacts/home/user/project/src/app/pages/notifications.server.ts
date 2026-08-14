"use server";

import { env } from "cloudflare:workers";

export interface Notification {
  id: string;
  severity: "info" | "warning" | "error";
  read: boolean;
  timestamp: number;
}

export async function createNotification(severity: "info" | "warning" | "error") {
  const namespace = env.SYNCED_STATE_SERVER as any;
  if (!namespace) {
    throw new Error("SYNCED_STATE_SERVER namespace not bound");
  }
  const id = namespace.idFromName("syncedState");
  const stub = namespace.get(id);

  const raw = await stub.getState("notifications");
  const notifications = Array.isArray(raw) ? (raw as Notification[]) : [];

  const newNotif: Notification = {
    id: crypto.randomUUID(),
    severity,
    read: false,
    timestamp: Date.now(),
  };

  const updated = [newNotif, ...notifications];
  await stub.setState(updated, "notifications");
  return newNotif;
}
