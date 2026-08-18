import React, { useState, useEffect } from "react";
import { logout } from "wasp/client/auth";
import { useSocketListener } from "wasp/client/webSocket";
import {
  useQuery,
  getNotifications,
  getNotificationPreferences,
} from "wasp/client/operations";
import {
  batchUpdateNotificationStatus,
  updateNotificationPreferences,
  triggerNotificationEvent,
} from "wasp/client/operations";

export function MainPage() {
  const { data: notifications, isLoading: isNotificationsLoading } = useQuery(getNotifications);
  const { data: preferences, isLoading: isPreferencesLoading } = useQuery(getNotificationPreferences);

  const [systemEnabled, setSystemEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [activityEnabled, setActivityEnabled] = useState(true);

  const [triggerType, setTriggerType] = useState<"SYSTEM" | "SECURITY" | "ACTIVITY" | string>("SYSTEM");
  const [triggerTitle, setTriggerTitle] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");

  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (preferences) {
      setSystemEnabled(preferences.systemEnabled);
      setSecurityEnabled(preferences.securityEnabled);
      setActivityEnabled(preferences.activityEnabled);
    }
  }, [preferences]);

  useSocketListener("notification", (notification: any) => {
    setRealtimeAlerts((prev) => [notification, ...prev]);
  });

  const handleSavePreferences = async () => {
    try {
      await updateNotificationPreferences({
        systemEnabled,
        securityEnabled,
        activityEnabled,
      });
      alert("Preferences saved successfully!");
    } catch (err: any) {
      alert("Error saving preferences: " + err.message);
    }
  };

  const handleTriggerNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await triggerNotificationEvent({
        type: triggerType as "SYSTEM" | "SECURITY" | "ACTIVITY",
        title: triggerTitle,
        message: triggerMessage,
      });
      if (res.created) {
        setTriggerTitle("");
        setTriggerMessage("");
      } else {
        alert("Notification not created because the preference for this type is disabled.");
      }
    } catch (err: any) {
      alert("Error triggering notification: " + err.message);
    }
  };

  const handleCheckboxChange = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleBatchUpdate = async (isRead: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      await batchUpdateNotificationStatus({
        ids: selectedIds,
        isRead,
      });
      setSelectedIds([]);
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h1>Notification Center</h1>
        <button data-testid="logout-btn" onClick={logout} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Logout
        </button>
      </header>

      {/* Preferences Section */}
      <section style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
        <h2>Notification Preferences</h2>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            <input
              type="checkbox"
              data-testid="pref-system"
              checked={systemEnabled}
              onChange={(e) => setSystemEnabled(e.target.checked)}
            />{" "}
            System Notifications
          </label>
          <label style={{ display: "block", marginBottom: "8px" }}>
            <input
              type="checkbox"
              data-testid="pref-security"
              checked={securityEnabled}
              onChange={(e) => setSecurityEnabled(e.target.checked)}
            />{" "}
            Security Notifications
          </label>
          <label style={{ display: "block", marginBottom: "8px" }}>
            <input
              type="checkbox"
              data-testid="pref-activity"
              checked={activityEnabled}
              onChange={(e) => setActivityEnabled(e.target.checked)}
            />{" "}
            Activity Notifications
          </label>
        </div>
        <button
          data-testid="save-pref-btn"
          onClick={handleSavePreferences}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Save Preferences
        </button>
      </section>

      {/* Trigger Notification Form */}
      <section style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
        <h2>Trigger Notification Event</h2>
        <form onSubmit={handleTriggerNotification}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>Type:</label>
            <select
              data-testid="trigger-type"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="SYSTEM">SYSTEM</option>
              <option value="SECURITY">SECURITY</option>
              <option value="ACTIVITY">ACTIVITY</option>
            </select>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>Title:</label>
            <input
              type="text"
              data-testid="trigger-title"
              value={triggerTitle}
              onChange={(e) => setTriggerTitle(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
              required
            />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>Message:</label>
            <textarea
              data-testid="trigger-message"
              value={triggerMessage}
              onChange={(e) => setTriggerMessage(e.target.value)}
              style={{ width: "100%", padding: "8px", height: "80px" }}
              required
            />
          </div>
          <button data-testid="trigger-btn" type="submit" style={{ padding: "8px 16px", cursor: "pointer" }}>
            Trigger Notification
          </button>
        </form>
      </section>

      {/* Real-Time Alerts List */}
      <section style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
        <h2>Real-Time Alerts</h2>
        <div data-testid="realtime-alerts" style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #eee", padding: "10px", borderRadius: "4px" }}>
          {realtimeAlerts.length === 0 ? (
            <p style={{ color: "#666" }}>No real-time alerts received yet.</p>
          ) : (
            realtimeAlerts.map((alert, idx) => (
              <div
                key={idx}
                data-testid="alert-item"
                style={{ borderBottom: "1px solid #eee", paddingBottom: "8px", marginBottom: "8px", color: "green" }}
              >
                <strong>[{alert.type}] {alert.title}</strong>: {alert.message}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Stored Notifications List */}
      <section style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
        <h2>Stored Notifications</h2>
        <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
          <button
            data-testid="mark-read-btn"
            onClick={() => handleBatchUpdate(true)}
            disabled={selectedIds.length === 0}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Mark as Read
          </button>
          <button
            data-testid="mark-unread-btn"
            onClick={() => handleBatchUpdate(false)}
            disabled={selectedIds.length === 0}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Mark as Unread
          </button>
        </div>

        <div data-testid="notifications-list">
          {isNotificationsLoading ? (
            <p>Loading notifications...</p>
          ) : !notifications || notifications.length === 0 ? (
            <p style={{ color: "#666" }}>No stored notifications.</p>
          ) : (
            notifications.map((notification: any) => (
              <div
                key={notification.id}
                data-testid="notification-item"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  borderBottom: "1px solid #eee",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              >
                <input
                  type="checkbox"
                  data-testid="notification-checkbox"
                  data-notification-id={notification.id}
                  checked={selectedIds.includes(notification.id)}
                  onChange={(e) => handleCheckboxChange(notification.id, e.target.checked)}
                  style={{ marginTop: "4px" }}
                />
                <div>
                  <h3 data-testid="notification-title" style={{ margin: "0 0 4px 0" }}>
                    {notification.title}
                  </h3>
                  <p data-testid="notification-message" style={{ margin: "0 0 4px 0", color: "#333" }}>
                    {notification.message}
                  </p>
                  <div style={{ display: "flex", gap: "10px", fontSize: "0.85em", color: "#666" }}>
                    <span data-testid="notification-type">Type: {notification.type}</span>
                    <span data-testid="notification-status">
                      {notification.isRead ? "Read" : "Unread"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
