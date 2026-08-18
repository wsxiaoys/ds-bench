"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { emitNotification } from "./actions";

interface Notification {
  id: string;
  severity: "info" | "warning" | "error";
  read: boolean;
  created_at: number;
}

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useSyncedState<Notification[]>([], "notifications", "global");
  const [filter, setFilter] = useState<"all" | "info" | "warning" | "error">("all");
  const [isEmitting, setIsEmitting] = useState<Record<string, boolean>>({
    info: false,
    warning: false,
    error: false,
  });

  const handleEmit = async (severity: "info" | "warning" | "error") => {
    setIsEmitting((prev) => ({ ...prev, [severity]: true }));
    try {
      await emitNotification(severity);
    } catch (err) {
      console.error("Failed to emit notification:", err);
    } finally {
      setIsEmitting((prev) => ({ ...prev, [severity]: false }));
    }
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      (prev || []).map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) =>
      (prev || []).map((n) => ({ ...n, read: true }))
    );
  };

  const currentNotifications = notifications || [];
  const unreadCount = currentNotifications.filter((n) => !n.read).length;

  const visibleNotifications =
    filter === "all"
      ? currentNotifications
      : currentNotifications.filter((n) => n.severity === filter);

  const visibleCount = visibleNotifications.length;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <header style={headerStyle}>
          <div style={titleContainerStyle}>
            <h1 style={titleStyle}>Real-time Notification Center</h1>
            <span data-testid="unread-count" style={badgeStyle}>
              {unreadCount}
            </span>
          </div>
          <p style={subtitleStyle}>
            Server-originated notifications broadcast live to connected clients.
          </p>
        </header>

        {/* Emit Controls */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Simulate Server Push</h2>
          <div style={buttonGroupStyle}>
            <button
              data-testid="emit-info"
              onClick={() => handleEmit("info")}
              disabled={isEmitting.info}
              style={{ ...btnStyle, ...btnInfoStyle }}
            >
              {isEmitting.info ? "Emitting..." : "Emit Info"}
            </button>
            <button
              data-testid="emit-warning"
              onClick={() => handleEmit("warning")}
              disabled={isEmitting.warning}
              style={{ ...btnStyle, ...btnWarningStyle }}
            >
              {isEmitting.warning ? "Emitting..." : "Emit Warning"}
            </button>
            <button
              data-testid="emit-error"
              onClick={() => handleEmit("error")}
              disabled={isEmitting.error}
              style={{ ...btnStyle, ...btnErrorStyle }}
            >
              {isEmitting.error ? "Emitting..." : "Emit Error"}
            </button>
          </div>
        </section>

        {/* Filters and Actions */}
        <section style={filterSectionStyle}>
          <div style={filterGroupStyle}>
            <button
              data-testid="filter-all"
              onClick={() => setFilter("all")}
              style={filter === "all" ? activeFilterStyle : inactiveFilterStyle}
            >
              All
            </button>
            <button
              data-testid="filter-info"
              onClick={() => setFilter("info")}
              style={filter === "info" ? activeFilterStyle : inactiveFilterStyle}
            >
              Info
            </button>
            <button
              data-testid="filter-warning"
              onClick={() => setFilter("warning")}
              style={filter === "warning" ? activeFilterStyle : inactiveFilterStyle}
            >
              Warning
            </button>
            <button
              data-testid="filter-error"
              onClick={() => setFilter("error")}
              style={filter === "error" ? activeFilterStyle : inactiveFilterStyle}
            >
              Error
            </button>
          </div>

          <button
            data-testid="read-all"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            style={markAllBtnStyle}
          >
            Mark All Read
          </button>
        </section>

        {/* Visible Count */}
        <div style={countContainerStyle}>
          Showing <strong data-testid="visible-count">{visibleCount}</strong>{" "}
          notification{visibleCount !== 1 ? "s" : ""}
        </div>

        {/* Notifications List */}
        <div data-testid="notif-list" style={listStyle}>
          {visibleNotifications.length === 0 ? (
            <div style={emptyStateStyle}>No notifications to display.</div>
          ) : (
            visibleNotifications.map((notif) => (
              <div
                key={notif.id}
                data-testid={`notif-${notif.id}`}
                data-severity={notif.severity}
                data-read={notif.read ? "true" : "false"}
                style={{
                  ...notifItemStyle,
                  ...(notif.read ? notifReadStyle : notifUnreadStyle),
                  borderLeft: `5px solid ${severityColor[notif.severity]}`,
                }}
              >
                <div style={notifContentStyle}>
                  <div style={notifHeaderStyle}>
                    <span
                      style={{
                        ...severityTagStyle,
                        backgroundColor: severityBgColor[notif.severity],
                        color: severityColor[notif.severity],
                      }}
                    >
                      {notif.severity.toUpperCase()}
                    </span>
                    <span style={notifTimeStyle}>
                      {new Date(notif.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={notifBodyStyle}>
                    This is a simulated {notif.severity} notification.
                  </div>
                </div>

                {!notif.read && (
                  <button
                    data-testid={`read-${notif.id}`}
                    onClick={() => handleMarkRead(notif.id)}
                    style={markReadBtnStyle}
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
  );
};

// Styles
const containerStyle: React.CSSProperties = {
  fontFamily: '"Noto Sans", sans-serif',
  backgroundColor: "#f3f4f6",
  minHeight: "100vh",
  padding: "2rem 1rem",
  display: "flex",
  justifyContent: "center",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  width: "100%",
  maxWidth: "640px",
  padding: "2rem",
};

const headerStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: "1.5rem",
  marginBottom: "1.5rem",
};

const titleContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
  marginBottom: "0.5rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#111827",
  margin: 0,
};

const badgeStyle: React.CSSProperties = {
  backgroundColor: "#ef4444",
  color: "#ffffff",
  borderRadius: "9999px",
  padding: "0.25rem 0.75rem",
  fontSize: "0.875rem",
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  color: "#6b7280",
  margin: 0,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "1.5rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "0.75rem",
  marginTop: 0,
};

const buttonGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
};

const btnStyle: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  borderRadius: "6px",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
  border: "none",
  transition: "opacity 0.2s",
};

const btnInfoStyle: React.CSSProperties = {
  backgroundColor: "#3b82f6",
  color: "#ffffff",
};

const btnWarningStyle: React.CSSProperties = {
  backgroundColor: "#f59e0b",
  color: "#ffffff",
};

const btnErrorStyle: React.CSSProperties = {
  backgroundColor: "#ef4444",
  color: "#ffffff",
};

const filterSectionStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderTop: "1px solid #e5e7eb",
  paddingTop: "1.5rem",
  marginBottom: "1rem",
  flexWrap: "wrap",
  gap: "1rem",
};

const filterGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
};

const filterBtnBase: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid #d1d5db",
  transition: "all 0.2s",
};

const activeFilterStyle: React.CSSProperties = {
  ...filterBtnBase,
  backgroundColor: "#1f2937",
  color: "#ffffff",
  borderColor: "#1f2937",
};

const inactiveFilterStyle: React.CSSProperties = {
  ...filterBtnBase,
  backgroundColor: "#ffffff",
  color: "#4b5563",
};

const markAllBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#ffffff",
  color: "#ef4444",
  border: "1px solid #ef4444",
  transition: "all 0.2s",
};

const countContainerStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#6b7280",
  marginBottom: "1rem",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "3rem 1rem",
  color: "#9ca3af",
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  border: "1px dashed #e5e7eb",
};

const notifItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1rem",
  borderRadius: "8px",
  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  transition: "all 0.2s",
};

const notifUnreadStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
};

const notifReadStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  border: "1px solid #f3f4f6",
  opacity: 0.75,
};

const notifContentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  flex: 1,
};

const notifHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const severityTagStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  padding: "0.15rem 0.4rem",
  borderRadius: "4px",
};

const notifTimeStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9ca3af",
};

const notifBodyStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "#374151",
};

const markReadBtnStyle: React.CSSProperties = {
  padding: "0.35rem 0.7rem",
  borderRadius: "4px",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: "#e5e7eb",
  color: "#374151",
  border: "none",
  marginLeft: "1rem",
  transition: "background-color 0.2s",
};

// Color mappings
const severityColor = {
  info: "#3b82f6",
  warning: "#f59e0b",
  error: "#ef4444",
};

const severityBgColor = {
  info: "#eff6ff",
  warning: "#fffbeb",
  error: "#fef2f2",
};
