import { useEffect, useState } from "react";
import type { AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import {
  useQuery,
  getNotifications,
  getNotificationPreferences,
  batchUpdateNotificationStatus,
  updateNotificationPreferences,
  triggerNotificationEvent,
} from "wasp/client/operations";
import {
  useSocketListener,
  type ServerToClientPayload,
} from "wasp/client/webSocket";
import "./Main.css";

type NotificationType = "SYSTEM" | "SECURITY" | "ACTIVITY";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: notifications, refetch: refetchNotifications } =
    useQuery(getNotifications);
  const { data: preferences, refetch: refetchPreferences } = useQuery(
    getNotificationPreferences
  );

  const [systemEnabled, setSystemEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [activityEnabled, setActivityEnabled] = useState(true);

  useEffect(() => {
    if (preferences) {
      setSystemEnabled(preferences.systemEnabled);
      setSecurityEnabled(preferences.securityEnabled);
      setActivityEnabled(preferences.activityEnabled);
    }
  }, [preferences]);

  const [triggerType, setTriggerType] = useState<NotificationType>("SYSTEM");
  const [triggerTitle, setTriggerTitle] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");

  const [realtimeAlerts, setRealtimeAlerts] = useState<
    ServerToClientPayload<"notification">[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useSocketListener("notification", (notification) => {
    setRealtimeAlerts((prev) => [notification, ...prev]);
    refetchNotifications();
  });

  async function handleSavePreferences() {
    await updateNotificationPreferences({
      systemEnabled,
      securityEnabled,
      activityEnabled,
    });
    refetchPreferences();
  }

  async function handleTrigger() {
    if (!triggerTitle || !triggerMessage) {
      return;
    }
    await triggerNotificationEvent({
      type: triggerType,
      title: triggerTitle,
      message: triggerMessage,
    });
    setTriggerTitle("");
    setTriggerMessage("");
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((existingId) => existingId !== id) : [...prev, id]
    );
  }

  async function handleBatchUpdate(isRead: boolean) {
    if (selectedIds.length === 0) {
      return;
    }
    await batchUpdateNotificationStatus({ ids: selectedIds, isRead });
    setSelectedIds([]);
    refetchNotifications();
  }

  return (
    <main className="container">
      <div className="header">
        <h1>Notification Center</h1>
        <span>Signed in as {user.identities.username?.id}</span>
        <button data-testid="logout-btn" onClick={() => logout()}>
          Logout
        </button>
      </div>

      <section>
        <h2>Preferences</h2>
        <label>
          <input
            type="checkbox"
            data-testid="pref-system"
            checked={systemEnabled}
            onChange={(e) => setSystemEnabled(e.target.checked)}
          />
          System
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="pref-security"
            checked={securityEnabled}
            onChange={(e) => setSecurityEnabled(e.target.checked)}
          />
          Security
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="pref-activity"
            checked={activityEnabled}
            onChange={(e) => setActivityEnabled(e.target.checked)}
          />
          Activity
        </label>
        <button data-testid="save-pref-btn" onClick={handleSavePreferences}>
          Save Preferences
        </button>
      </section>

      <section>
        <h2>Trigger Notification</h2>
        <select
          data-testid="trigger-type"
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value as NotificationType)}
        >
          <option value="SYSTEM">SYSTEM</option>
          <option value="SECURITY">SECURITY</option>
          <option value="ACTIVITY">ACTIVITY</option>
        </select>
        <input
          data-testid="trigger-title"
          placeholder="Title"
          value={triggerTitle}
          onChange={(e) => setTriggerTitle(e.target.value)}
        />
        <input
          data-testid="trigger-message"
          placeholder="Message"
          value={triggerMessage}
          onChange={(e) => setTriggerMessage(e.target.value)}
        />
        <button data-testid="trigger-btn" onClick={handleTrigger}>
          Trigger
        </button>
      </section>

      <section>
        <h2>Real-Time Alerts</h2>
        <ul data-testid="realtime-alerts">
          {realtimeAlerts.map((alert) => (
            <li key={alert.id} data-testid="alert-item">
              <strong>{alert.title}</strong>: {alert.message} ({alert.type})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Notifications</h2>
        <div>
          <button
            data-testid="mark-read-btn"
            onClick={() => handleBatchUpdate(true)}
          >
            Mark Read
          </button>
          <button
            data-testid="mark-unread-btn"
            onClick={() => handleBatchUpdate(false)}
          >
            Mark Unread
          </button>
        </div>
        <ul data-testid="notifications-list">
          {notifications?.map((notification) => (
            <li key={notification.id} data-testid="notification-item">
              <input
                type="checkbox"
                data-testid="notification-checkbox"
                data-notification-id={notification.id}
                checked={selectedIds.includes(notification.id)}
                onChange={() => toggleSelect(notification.id)}
              />
              <span data-testid="notification-title">{notification.title}</span>
              <span data-testid="notification-message">
                {notification.message}
              </span>
              <span data-testid="notification-type">{notification.type}</span>
              <span data-testid="notification-status">
                {notification.isRead ? "Read" : "Unread"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
