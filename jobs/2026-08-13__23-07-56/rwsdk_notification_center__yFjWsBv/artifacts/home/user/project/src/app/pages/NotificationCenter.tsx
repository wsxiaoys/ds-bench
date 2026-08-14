"use client";

import React, { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { emitNotificationOnServer, type Notification } from "./notifActions.js";

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useSyncedState<Notification[]>([], "notifications");
  const [filter, setFilter] = useState<"all" | "info" | "warning" | "error">("all");
  const [isEmitting, setIsEmitting] = useState(false);

  const list = Array.isArray(notifications) ? notifications : [];

  const sortedList = [...list].sort((a, b) => b.timestamp - a.timestamp);

  const unreadCount = sortedList.filter(n => !n.read).length;

  const filteredList = sortedList.filter(n => {
    if (filter === "all") return true;
    return n.severity === filter;
  });

  const handleEmit = async (severity: "info" | "warning" | "error") => {
    setIsEmitting(true);
    try {
      await emitNotificationOnServer(severity);
    } catch (err) {
      console.error("Failed to emit notification:", err);
    } finally {
      setIsEmitting(false);
    }
  };

  const markRead = (id: string) => {
    setNotifications(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.map(n => n.id === id ? { ...n, read: true } : n);
    });
  };

  const markAllRead = () => {
    setNotifications(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.map(n => ({ ...n, read: true }));
    });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Real-time Notification Center</h1>
        <p style={styles.subtitle}>
          Server-originated notifications broadcast live to all clients.
        </p>
      </header>

      <div style={styles.mainGrid}>
        {/* Left column: Controls */}
        <div style={styles.controlPanel}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Simulate Server Push</h2>
            <div style={styles.buttonGroup}>
              <button
                data-testid="emit-info"
                onClick={() => handleEmit("info")}
                disabled={isEmitting}
                style={{ ...styles.button, ...styles.btnInfo }}
              >
                Emit Info
              </button>
              <button
                data-testid="emit-warning"
                onClick={() => handleEmit("warning")}
                disabled={isEmitting}
                style={{ ...styles.button, ...styles.btnWarning }}
              >
                Emit Warning
              </button>
              <button
                data-testid="emit-error"
                onClick={() => handleEmit("error")}
                disabled={isEmitting}
                style={{ ...styles.button, ...styles.btnError }}
              >
                Emit Error
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Filters</h2>
            <div style={styles.filterGroup}>
              <button
                data-testid="filter-all"
                onClick={() => setFilter("all")}
                style={{
                  ...styles.filterBtn,
                  ...(filter === "all" ? styles.filterBtnActive : {}),
                }}
              >
                All
              </button>
              <button
                data-testid="filter-info"
                onClick={() => setFilter("info")}
                style={{
                  ...styles.filterBtn,
                  ...(filter === "info" ? styles.filterBtnActive : {}),
                }}
              >
                Info
              </button>
              <button
                data-testid="filter-warning"
                onClick={() => setFilter("warning")}
                style={{
                  ...styles.filterBtn,
                  ...(filter === "warning" ? styles.filterBtnActive : {}),
                }}
              >
                Warning
              </button>
              <button
                data-testid="filter-error"
                onClick={() => setFilter("error")}
                style={{
                  ...styles.filterBtn,
                  ...(filter === "error" ? styles.filterBtnActive : {}),
                }}
              >
                Error
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Stats</h2>
            <div style={styles.statsContainer}>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Unread Count</span>
                <span data-testid="unread-count" style={styles.statValue}>
                  {unreadCount}
                </span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statLabel}>Visible ({filter})</span>
                <span data-testid="visible-count" style={styles.statValue}>
                  {filteredList.length}
                </span>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <button
              data-testid="read-all"
              onClick={markAllRead}
              style={{ ...styles.button, ...styles.btnMarkAll }}
            >
              Mark All Read
            </button>
          </div>
        </div>

        {/* Right column: Notifications List */}
        <div style={styles.listPanel}>
          <h2 style={styles.sectionTitle}>Notifications List</h2>
          <div data-testid="notif-list" style={styles.listContainer}>
            {filteredList.length === 0 ? (
              <div style={styles.emptyState}>No notifications to display.</div>
            ) : (
              filteredList.map(notif => (
                <div
                  key={notif.id}
                  data-testid={`notif-${notif.id}`}
                  data-severity={notif.severity}
                  data-read={notif.read ? "true" : "false"}
                  style={{
                    ...styles.notifItem,
                    ...(notif.read ? styles.notifItemRead : styles.notifItemUnread),
                    ...styles[`notifBorder_${notif.severity}`],
                  }}
                >
                  <div style={styles.notifContent}>
                    <div style={styles.notifMeta}>
                      <span style={{
                        ...styles.badge,
                        ...styles[`badge_${notif.severity}`]
                      }}>
                        {notif.severity.toUpperCase()}
                      </span>
                      <span style={styles.notifTime}>
                        {new Date(notif.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p style={styles.notifText}>
                      This is a simulated {notif.severity} notification.
                    </p>
                  </div>
                  {!notif.read && (
                    <button
                      data-testid={`read-${notif.id}`}
                      onClick={() => markRead(notif.id)}
                      style={styles.markReadBtn}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, any> = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1a1a1a",
  },
  header: {
    marginBottom: "2rem",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "1rem",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    margin: 0,
    color: "#111827",
  },
  subtitle: {
    fontSize: "1.1rem",
    color: "#4b5563",
    margin: "0.5rem 0 0 0",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "2rem",
    alignItems: "start",
  },
  controlPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    background: "#f9fafb",
    padding: "1.5rem",
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  },
  listPanel: {
    background: "#ffffff",
    padding: "1.5rem",
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
    minHeight: "400px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  sectionTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    margin: 0,
    color: "#374151",
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  button: {
    padding: "0.75rem 1rem",
    border: "none",
    borderRadius: "0.375rem",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "0.95rem",
    transition: "background-color 0.2s",
  },
  btnInfo: {
    backgroundColor: "#3b82f6",
    color: "#ffffff",
  },
  btnWarning: {
    backgroundColor: "#f59e0b",
    color: "#ffffff",
  },
  btnError: {
    backgroundColor: "#ef4444",
    color: "#ffffff",
  },
  btnMarkAll: {
    backgroundColor: "#10b981",
    color: "#ffffff",
    width: "100%",
  },
  filterGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.5rem",
  },
  filterBtn: {
    padding: "0.5rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.375rem",
    backgroundColor: "#ffffff",
    color: "#374151",
    cursor: "pointer",
    fontWeight: "500",
    fontSize: "0.9rem",
    textAlign: "center",
  },
  filterBtnActive: {
    backgroundColor: "#374151",
    color: "#ffffff",
    borderColor: "#374151",
  },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
  },
  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    padding: "0.75rem",
    borderRadius: "0.375rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  statLabel: {
    fontSize: "0.8rem",
    color: "#6b7280",
    fontWeight: "500",
    textAlign: "center",
  },
  statValue: {
    fontSize: "1.5rem",
    fontWeight: "bold",
    color: "#111827",
    marginTop: "0.25rem",
  },
  listContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginTop: "1rem",
  },
  emptyState: {
    textAlign: "center",
    color: "#9ca3af",
    padding: "3rem 0",
    fontSize: "1.1rem",
  },
  notifItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem",
    borderRadius: "0.375rem",
    borderLeft: "4px solid transparent",
    transition: "background-color 0.2s",
  },
  notifItemUnread: {
    backgroundColor: "#f3f4f6",
  },
  notifItemRead: {
    backgroundColor: "#ffffff",
    opacity: 0.7,
    border: "1px solid #e5e7eb",
  },
  notifBorder_info: {
    borderLeftColor: "#3b82f6",
  },
  notifBorder_warning: {
    borderLeftColor: "#f59e0b",
  },
  notifBorder_error: {
    borderLeftColor: "#ef4444",
  },
  notifContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    flex: 1,
  },
  notifMeta: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  badge: {
    fontSize: "0.7rem",
    fontWeight: "bold",
    padding: "0.15rem 0.4rem",
    borderRadius: "0.25rem",
  },
  badge_info: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  badge_warning: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  badge_error: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  notifTime: {
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
  notifText: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.95rem",
    color: "#374151",
  },
  markReadBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.85rem",
    fontWeight: "600",
    color: "#2563eb",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "0.25rem",
    cursor: "pointer",
    marginLeft: "1rem",
    transition: "background-color 0.2s",
  },
};
