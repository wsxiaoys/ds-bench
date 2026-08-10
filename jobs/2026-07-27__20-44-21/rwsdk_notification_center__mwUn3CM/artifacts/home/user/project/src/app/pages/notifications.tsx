"use client";

import React, { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import {
  emitNotificationServer,
  markAllReadServer,
  markReadServer,
  type Notification,
} from "./notifications.actions";
import styles from "./notifications.module.css";

export const Notifications = () => {
  const [notifications, setNotifications] = useSyncedState<Notification[]>([], "notifications");
  const [filter, setFilter] = useState<"all" | "info" | "warning" | "error">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const visibleNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    return n.severity === filter;
  });

  const visibleCount = visibleNotifications.length;

  const handleEmit = async (severity: "info" | "warning" | "error") => {
    try {
      await emitNotificationServer(severity);
    } catch (err) {
      console.error("Error emitting notification:", err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markReadServer(id);
    } catch (err) {
      console.error("Error marking notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllReadServer();
    } catch (err) {
      console.error("Error marking all notifications read:", err);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Notification Center</h1>
        <div className={styles.badgeContainer}>
          <span className={styles.badge}>
            Unread: <span data-testid="unread-count">{unreadCount}</span>
          </span>
          {unreadCount > 0 && (
            <button
              data-testid="read-all"
              className={`${styles.button} ${styles.btnAction}`}
              onClick={handleMarkAllRead}
            >
              Mark All Read
            </button>
          )}
          {unreadCount === 0 && (
            <button
              data-testid="read-all"
              className={`${styles.button} ${styles.btnAction}`}
              onClick={handleMarkAllRead}
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              Mark All Read
            </button>
          )}
        </div>
      </header>

      <section className={styles.controlsSection}>
        <h2 className={styles.sectionTitle}>Simulate Server Push</h2>
        <div className={styles.buttonGroup}>
          <button
            data-testid="emit-info"
            className={`${styles.button} ${styles.btnInfo}`}
            onClick={() => handleEmit("info")}
          >
            Emit Info
          </button>
          <button
            data-testid="emit-warning"
            className={`${styles.button} ${styles.btnWarning}`}
            onClick={() => handleEmit("warning")}
          >
            Emit Warning
          </button>
          <button
            data-testid="emit-error"
            className={`${styles.button} ${styles.btnError}`}
            onClick={() => handleEmit("error")}
          >
            Emit Error
          </button>
        </div>
      </section>

      <section className={styles.filterSection}>
        <div className={styles.filterGroup}>
          <button
            data-testid="filter-all"
            className={`${styles.filterBtn} ${filter === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            data-testid="filter-info"
            className={`${styles.filterBtn} ${filter === "info" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter("info")}
          >
            Info
          </button>
          <button
            data-testid="filter-warning"
            className={`${styles.filterBtn} ${filter === "warning" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter("warning")}
          >
            Warning
          </button>
          <button
            data-testid="filter-error"
            className={`${styles.filterBtn} ${filter === "error" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter("error")}
          >
            Error
          </button>
        </div>
        <div className={styles.visibleIndicator}>
          Visible: <span data-testid="visible-count">{visibleCount}</span>
        </div>
      </section>

      <main>
        <ul data-testid="notif-list" className={styles.notifList}>
          {visibleNotifications.map((notif) => {
            const formattedTime = new Date(notif.createdAt).toLocaleTimeString();
            return (
              <li
                key={notif.id}
                data-testid={`notif-${notif.id}`}
                data-severity={notif.severity}
                data-read={notif.read ? "true" : "false"}
                className={`${styles.notifItem} ${styles[`severity_${notif.severity}`]} ${
                  notif.read ? styles.notifRead : styles.notifUnread
                }`}
              >
                <div className={styles.notifContent}>
                  <p className={styles.notifText}>
                    [{notif.severity.toUpperCase()}] New notification simulated on the server.
                  </p>
                  <span className={styles.notifMeta}>ID: {notif.id} | {formattedTime}</span>
                </div>
                {!notif.read && (
                  <button
                    data-testid={`read-${notif.id}`}
                    className={styles.markReadBtn}
                    onClick={() => handleMarkRead(notif.id)}
                  >
                    Mark Read
                  </button>
                )}
              </li>
            );
          })}
          {visibleCount === 0 && (
            <div className={styles.emptyState}>
              No notifications to display under this filter.
            </div>
          )}
        </ul>
      </main>
    </div>
  );
};
