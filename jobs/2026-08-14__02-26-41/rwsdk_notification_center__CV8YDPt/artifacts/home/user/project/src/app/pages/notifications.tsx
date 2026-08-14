"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { createNotification, type Notification } from "./notifications.server";

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useSyncedState<Notification[]>([], "notifications");
  const [filter, setFilter] = useState<"all" | "info" | "warning" | "error">("all");

  const notifs = notifications ?? [];

  // Calculate unread count across all notifications
  const unreadCount = notifs.filter((n) => !n.read).length;

  // Filter notifications based on local state
  const filteredNotifs = notifs.filter((n) => filter === "all" || n.severity === filter);

  // Handlers
  const handleEmit = async (severity: "info" | "warning" | "error") => {
    try {
      await createNotification(severity);
    } catch (err) {
      console.error("Failed to emit notification:", err);
    }
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => {
      const current = prev ?? [];
      return current.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => {
      const current = prev ?? [];
      return current.map((n) => ({ ...n, read: true }));
    });
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>Real-time Notification Center</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: "bold" }}>Unread notifications:</span>
          <span
            data-testid="unread-count"
            style={{
              backgroundColor: "#ef4444",
              color: "white",
              borderRadius: "9999px",
              padding: "0.25rem 0.75rem",
              fontWeight: "bold",
              fontSize: "1rem",
            }}
          >
            {unreadCount}
          </span>
        </div>
      </header>

      <section style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "#f3f4f6", borderRadius: "8px" }}>
        <h2>Simulate Server Push</h2>
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <button
            data-testid="emit-info"
            onClick={() => handleEmit("info")}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Emit Info
          </button>
          <button
            data-testid="emit-warning"
            onClick={() => handleEmit("warning")}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#f59e0b", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Emit Warning
          </button>
          <button
            data-testid="emit-error"
            onClick={() => handleEmit("error")}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            Emit Error
          </button>
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span>Filter:</span>
          <button
            data-testid="filter-all"
            onClick={() => setFilter("all")}
            style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: filter === "all" ? "#4b5563" : "#e5e7eb",
              color: filter === "all" ? "white" : "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            All
          </button>
          <button
            data-testid="filter-info"
            onClick={() => setFilter("info")}
            style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: filter === "info" ? "#3b82f6" : "#e5e7eb",
              color: filter === "info" ? "white" : "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Info
          </button>
          <button
            data-testid="filter-warning"
            onClick={() => setFilter("warning")}
            style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: filter === "warning" ? "#f59e0b" : "#e5e7eb",
              color: filter === "warning" ? "white" : "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Warning
          </button>
          <button
            data-testid="filter-error"
            onClick={() => setFilter("error")}
            style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: filter === "error" ? "#ef4444" : "#e5e7eb",
              color: filter === "error" ? "white" : "black",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Error
          </button>
        </div>

        <button
          data-testid="read-all"
          onClick={handleMarkAllRead}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Mark All Read
        </button>
      </section>

      <section style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span>Visible count:</span>
          <span data-testid="visible-count" style={{ fontWeight: "bold" }}>
            {filteredNotifs.length}
          </span>
        </div>
      </section>

      <main>
        <div
          data-testid="notif-list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "1rem",
            minHeight: "100px",
            backgroundColor: "#f9fafb",
          }}
        >
          {filteredNotifs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
              No notifications to display.
            </div>
          ) : (
            filteredNotifs.map((notif) => (
              <div
                key={notif.id}
                data-testid={`notif-${notif.id}`}
                data-severity={notif.severity}
                data-read={notif.read ? "true" : "false"}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderLeft: `6px solid ${
                    notif.severity === "error"
                      ? "#ef4444"
                      : notif.severity === "warning"
                      ? "#f59e0b"
                      : "#3b82f6"
                  }`,
                  backgroundColor: notif.read ? "#f3f4f6" : "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  borderRadius: "4px",
                }}
              >
                <div>
                  <span
                    style={{
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      color:
                        notif.severity === "error"
                          ? "#ef4444"
                          : notif.severity === "warning"
                          ? "#f59e0b"
                          : "#3b82f6",
                    }}
                  >
                    [{notif.severity}]
                  </span>
                  <span style={{ marginLeft: "0.5rem", color: notif.read ? "#6b7280" : "#111827", textDecoration: notif.read ? "line-through" : "none" }}>
                    New notification created on server.
                  </span>
                </div>
                {!notif.read && (
                  <button
                    data-testid={`read-${notif.id}`}
                    onClick={() => handleMarkRead(notif.id)}
                    style={{
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "#e5e7eb",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};
