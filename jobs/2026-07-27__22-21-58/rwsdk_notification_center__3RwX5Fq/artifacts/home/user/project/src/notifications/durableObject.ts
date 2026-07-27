import { DurableObject } from "cloudflare:workers";

import type { Notification, Severity } from "./types";

const STORAGE_KEY = "notifications";

/**
 * Durable Object that is the source of truth for notifications.
 *
 * Notifications (and their read state) are stored in the Durable Object's
 * own durable storage, so they survive page reloads, worker restarts, and
 * Durable Object eviction/hibernation - there is no reliance on any
 * in-memory-only state.
 */
export class NotificationsDurableObject extends DurableObject {
  private async load(): Promise<Notification[]> {
    const stored = await this.ctx.storage.get<Notification[]>(STORAGE_KEY);
    return stored ?? [];
  }

  private async save(notifications: Notification[]): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEY, notifications);
  }

  async list(): Promise<Notification[]> {
    return this.load();
  }

  async emit(severity: Severity): Promise<Notification[]> {
    const notifications = await this.load();
    const notification: Notification = {
      id: crypto.randomUUID(),
      severity,
      read: false,
      createdAt: Date.now(),
    };
    // Newest first.
    const next = [notification, ...notifications];
    await this.save(next);
    return next;
  }

  async markRead(id: string): Promise<Notification[]> {
    const notifications = await this.load();
    const next = notifications.map((notification) =>
      notification.id === id
        ? { ...notification, read: true }
        : notification,
    );
    await this.save(next);
    return next;
  }

  async markAllRead(): Promise<Notification[]> {
    const notifications = await this.load();
    const next = notifications.map((notification) => ({
      ...notification,
      read: true,
    }));
    await this.save(next);
    return next;
  }
}
