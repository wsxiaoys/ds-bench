"use client";

import { useMemo, useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

import type { Notification, Severity } from "@/notifications/types";

import {
  emitNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "./actions";

type Filter = "all" | Severity;

const SYNC_KEY = "notifications";

const FILTERS: Filter[] = ["all", "info", "warning", "error"];

export function NotificationsCenter({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  // `useSyncedState` seeds from `initialNotifications` (fetched fresh on the
  // server for every page load/reload, from the durable notification store),
  // then stays in sync live via the synced-state Durable Object: any other
  // client emitting/reading a notification calls a server function that
  // pushes the new canonical list here, with no manual reload needed.
  const [notifications] = useSyncedState<Notification[]>(
    initialNotifications,
    SYNC_KEY,
  );
  // The active filter is per-client UI state only - it must never be synced.
  const [filter, setFilter] = useState<Filter>("all");

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.createdAt - a.createdAt),
    [notifications],
  );

  const unreadCount = useMemo(
    () => sorted.filter((notification) => !notification.read).length,
    [sorted],
  );

  const visible = useMemo(
    () =>
      filter === "all"
        ? sorted
        : sorted.filter((notification) => notification.severity === filter),
    [sorted, filter],
  );

  return (
    <div>
      <section aria-label="Emit notification" style={{ marginBottom: "1rem" }}>
        <button
          data-testid="emit-info"
          onClick={() => void emitNotification("info")}
        >
          Emit info
        </button>{" "}
        <button
          data-testid="emit-warning"
          onClick={() => void emitNotification("warning")}
        >
          Emit warning
        </button>{" "}
        <button
          data-testid="emit-error"
          onClick={() => void emitNotification("error")}
        >
          Emit error
        </button>
      </section>

      <section style={{ marginBottom: "1rem" }}>
        Unread:{" "}
        <strong data-testid="unread-count">{unreadCount}</strong>
        {"   "}
        Visible: <strong data-testid="visible-count">{visible.length}</strong>
      </section>

      <section aria-label="Filters" style={{ marginBottom: "1rem" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            style={{ fontWeight: filter === f ? "bold" : "normal" }}
          >
            {f}
          </button>
        ))}{" "}
        <button
          data-testid="read-all"
          onClick={() => void markAllNotificationsRead()}
        >
          Mark all read
        </button>
      </section>

      <ul
        data-testid="notif-list"
        style={{ listStyle: "none", padding: 0, margin: 0 }}
      >
        {visible.map((notification) => (
          <li
            key={notification.id}
            data-testid={`notif-${notification.id}`}
            data-severity={notification.severity}
            data-read={notification.read ? "true" : "false"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              borderBottom: "1px solid #ddd",
              opacity: notification.read ? 0.6 : 1,
            }}
          >
            <span>[{notification.severity}]</span>
            <span>{notification.read ? "read" : "unread"}</span>
            <button
              data-testid={`read-${notification.id}`}
              onClick={() => void markNotificationRead(notification.id)}
            >
              Mark read
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
