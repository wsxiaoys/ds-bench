import { env } from "cloudflare:workers";

import type { Notification, Severity } from "./types";

// Must match the default Durable Object name that `syncedStateRoutes` uses
// when no room id is present in the URL (see rwsdk's
// `DEFAULT_SYNC_STATE_NAME`). The notification center's client component
// calls `useSyncedState(initial, "notifications")` without a room id, so we
// need to target the same Durable Object instance here when broadcasting.
const SYNCED_STATE_ROOM = "syncedState";
const SYNCED_STATE_KEY = "notifications";

// A single, well-known Durable Object instance holds all notifications -
// this is a shared/global notification center, not scoped per-user.
const NOTIFICATIONS_ROOM = "global";

const getNotificationsStub = () => {
  const id = env.NOTIFICATIONS_DURABLE_OBJECT.idFromName(NOTIFICATIONS_ROOM);
  return env.NOTIFICATIONS_DURABLE_OBJECT.get(id);
};

const getSyncedStateStub = () => {
  const id = env.SYNCED_STATE_SERVER.idFromName(SYNCED_STATE_ROOM);
  return env.SYNCED_STATE_SERVER.get(id);
};

const broadcast = async (notifications: Notification[]) => {
  // Push the new canonical list to every connected client subscribed to the
  // "notifications" key - this is what makes the update show up live,
  // without a reload, on every open `/notifications` tab.
  await getSyncedStateStub().setState(notifications, SYNCED_STATE_KEY);
};

export const listNotifications = async (): Promise<Notification[]> => {
  return getNotificationsStub().list();
};

export const emitNotification = async (
  severity: Severity,
): Promise<Notification[]> => {
  const notifications = await getNotificationsStub().emit(severity);
  await broadcast(notifications);
  return notifications;
};

export const markNotificationRead = async (
  id: string,
): Promise<Notification[]> => {
  const notifications = await getNotificationsStub().markRead(id);
  await broadcast(notifications);
  return notifications;
};

export const markAllNotificationsRead = async (): Promise<Notification[]> => {
  const notifications = await getNotificationsStub().markAllRead();
  await broadcast(notifications);
  return notifications;
};
