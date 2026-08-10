import { useState, useEffect, useCallback } from "react";
import { useQuery, useAction } from "wasp/client/operations";
import { useSocketListener } from "wasp/client/webSocket";
import { logout } from "wasp/client/auth";
import { getNotifications } from "wasp/client/operations";
import { batchUpdateNotificationStatus } from "wasp/client/operations";
import { getNotificationPreferences } from "wasp/client/operations";
import { updateNotificationPreferences } from "wasp/client/operations";
import { triggerNotificationEvent } from "wasp/client/operations";
import type { Notification, NotificationPreference } from "wasp/entities";
import "./Main.css";

export function MainPage() {
  const { data: notifications, refetch: refetchNotifications } = useQuery(getNotifications);
  const { data: preferences, refetch: refetchPreferences } = useQuery(getNotificationPreferences);
  const batchUpdate = useAction(batchUpdateNotificationStatus);
  const updatePrefs = useAction(updateNotificationPreferences);
  const trigger = useAction(triggerNotificationEvent);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [realtimeAlerts, setRealtimeAlerts] = useState<Notification[]>([]);

  const [prefSystem, setPrefSystem] = useState(true);
  const [prefSecurity, setPrefSecurity] = useState(true);
  const [prefActivity, setPrefActivity] = useState(true);

  const [triggerType, setTriggerType] = useState<"SYSTEM" | "SECURITY" | "ACTIVITY">("SYSTEM");
  const [triggerTitle, setTriggerTitle] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");

  useEffect(() => {
    if (preferences) {
      setPrefSystem(preferences.systemEnabled);
      setPrefSecurity(preferences.securityEnabled);
      setPrefActivity(preferences.activityEnabled);
    }
  }, [preferences]);

  useSocketListener("notification", useCallback((notification: unknown) => {
    const n = notification as Notification;
    setRealtimeAlerts((prev) => [n, ...prev]);
    refetchNotifications();
  }, [refetchNotifications]));

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchRead = async () => {
    await batchUpdate({ ids: selectedIds, isRead: true });
    setSelectedIds([]);
    refetchNotifications();
  };

  const handleBatchUnread = async () => {
    await batchUpdate({ ids: selectedIds, isRead: false });
    setSelectedIds([]);
    refetchNotifications();
  };

  const handleSavePreferences = async () => {
    await updatePrefs({
      systemEnabled: prefSystem,
      securityEnabled: prefSecurity,
      activityEnabled: prefActivity,
    });
    refetchPreferences();
  };

  const handleTrigger = async () => {
    await trigger({
      type: triggerType,
      title: triggerTitle,
      message: triggerMessage,
    });
    setTriggerTitle("");
    setTriggerMessage("");
    refetchNotifications();
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <main className="container notification-app">
      <div className="header">
        <h1 className="title">Notification Center</h1>
        <button data-testid="logout-btn" className="button button-outlined" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <section className="section">
        <h2>Preferences</h2>
        <div className="preferences">
          <label>
            <input
              type="checkbox"
              data-testid="pref-system"
              checked={prefSystem}
              onChange={(e) => setPrefSystem(e.target.checked)}
            />
            System
          </label>
          <label>
            <input
              type="checkbox"
              data-testid="pref-security"
              checked={prefSecurity}
              onChange={(e) => setPrefSecurity(e.target.checked)}
            />
            Security
          </label>
          <label>
            <input
              type="checkbox"
              data-testid="pref-activity"
              checked={prefActivity}
              onChange={(e) => setPrefActivity(e.target.checked)}
            />
            Activity
          </label>
          <button data-testid="save-pref-btn" className="button button-filled" onClick={handleSavePreferences}>
            Save Preferences
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Trigger Notification</h2>
        <div className="trigger-form">
          <select
            data-testid="trigger-type"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as "SYSTEM" | "SECURITY" | "ACTIVITY")}
          >
            <option value="SYSTEM">SYSTEM</option>
            <option value="SECURITY">SECURITY</option>
            <option value="ACTIVITY">ACTIVITY</option>
          </select>
          <input
            data-testid="trigger-title"
            type="text"
            placeholder="Title"
            value={triggerTitle}
            onChange={(e) => setTriggerTitle(e.target.value)}
          />
          <input
            data-testid="trigger-message"
            type="text"
            placeholder="Message"
            value={triggerMessage}
            onChange={(e) => setTriggerMessage(e.target.value)}
          />
          <button data-testid="trigger-btn" className="button button-filled" onClick={handleTrigger}>
            Trigger
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Real-Time Alerts</h2>
        <div data-testid="realtime-alerts" className="alerts-list">
          {realtimeAlerts.map((alert) => (
            <div key={alert.id} data-testid="alert-item" className="alert-item">
              <strong>{alert.title}</strong>: {alert.message} ({alert.type})
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Stored Notifications</h2>
        <div className="batch-actions">
          <button data-testid="mark-read-btn" className="button button-filled" onClick={handleBatchRead}>
            Mark as Read
          </button>
          <button data-testid="mark-unread-btn" className="button button-outlined" onClick={handleBatchUnread}>
            Mark as Unread
          </button>
        </div>
        <div data-testid="notifications-list" className="notifications-list">
          {notifications?.map((n) => (
            <div key={n.id} data-testid="notification-item" className="notification-item">
              <input
                type="checkbox"
                data-testid="notification-checkbox"
                data-notification-id={n.id}
                checked={selectedIds.includes(n.id)}
                onChange={() => toggleSelection(n.id)}
              />
              <span data-testid="notification-title" className="notification-title">{n.title}</span>
              <span data-testid="notification-message" className="notification-message">{n.message}</span>
              <span data-testid="notification-type" className="notification-type">{n.type}</span>
              <span data-testid="notification-status" className="notification-status">
                {n.isRead ? "Read" : "Unread"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
