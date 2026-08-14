"use server";

// @ts-ignore
import { serverAction } from "rwsdk/server";
import { env } from "cloudflare:workers";

export interface Notification {
  id: string;
  severity: "info" | "warning" | "error";
  read: boolean;
  timestamp: number;
}

// @ts-ignore
export const emitNotificationOnServer = serverAction(async (severity: "info" | "warning" | "error") => {
  const namespace = env.SYNCED_STATE_SERVER as DurableObjectNamespace<any>;
  const id = namespace.idFromName("syncedState");
  const stub = namespace.get(id);

  const currentVal = await stub.getState("notifications");
  const currentNotifications: Notification[] = Array.isArray(currentVal) ? currentVal : [];

  const newNotif: Notification = {
    id: crypto.randomUUID(),
    severity,
    read: false,
    timestamp: Date.now(),
  };

  const updated = [newNotif, ...currentNotifications];
  await stub.setState(updated, "notifications");

  return newNotif;
}) as (severity: "info" | "warning" | "error") => Promise<Notification>;
