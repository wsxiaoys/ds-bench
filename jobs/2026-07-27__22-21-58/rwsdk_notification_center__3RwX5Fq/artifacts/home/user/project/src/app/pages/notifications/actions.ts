"use server";

import {
  emitNotification as emitNotificationImpl,
  markAllNotificationsRead as markAllNotificationsReadImpl,
  markNotificationRead as markNotificationReadImpl,
} from "@/notifications/store";
import type { Severity } from "@/notifications/types";

// Server functions invoked from the client notification center. Each one
// mutates the durable, shared notification list (source of truth lives in
// NotificationsDurableObject) and then broadcasts the updated list through
// the synced-state Durable Object so every connected client updates live.

export async function emitNotification(severity: Severity) {
  return emitNotificationImpl(severity);
}

export async function markNotificationRead(id: string) {
  return markNotificationReadImpl(id);
}

export async function markAllNotificationsRead() {
  return markAllNotificationsReadImpl();
}
