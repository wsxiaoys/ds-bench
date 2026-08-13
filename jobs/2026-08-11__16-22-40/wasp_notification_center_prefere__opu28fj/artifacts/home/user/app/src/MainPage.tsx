import { useState, useEffect } from "react";
import { logout, useAuth } from "wasp/client/auth";
import { getUsername } from "wasp/auth";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import {
  useQuery,
  getNotifications,
  getNotificationPreferences,
  batchUpdateNotificationStatus,
  updateNotificationPreferences,
  triggerNotificationEvent,
} from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const { data: user } = useAuth();
  const { isConnected } = useSocket();

  // Preferences state
  const { data: preferences, isLoading: isPrefLoading } = useQuery(getNotificationPreferences);
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

  // Trigger form state
  const [triggerType, setTriggerType] = useState<"SYSTEM" | "SECURITY" | "ACTIVITY">("SYSTEM");
  const [triggerTitle, setTriggerTitle] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");

  // Real-time alerts state
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  // Stored notifications state
  const { data: notifications, isLoading: isNotificationsLoading } = useQuery(getNotifications);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Listen for real-time notification events
  useSocketListener("notification", (notification: any) => {
    setRealtimeAlerts((prev) => [notification, ...prev]);
  });

  const handleSavePreferences = async () => {
    try {
      await updateNotificationPreferences({ systemEnabled, securityEnabled, activityEnabled });
      alert("Preferences saved!");
    } catch (err: any) {
      alert("Error saving preferences: " + err.message);
    }
  };

  const handleTriggerNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerTitle || !triggerMessage) {
      alert("Please fill out title and message.");
      return;
    }
    try {
      const result = await triggerNotificationEvent({
        type: triggerType,
        title: triggerTitle,
        message: triggerMessage,
      });
      if (result.created) {
        console.log("Notification created and emitted!");
      } else {
        console.log("Notification ignored due to preferences.");
      }
      setTriggerTitle("");
      setTriggerMessage("");
    } catch (err: any) {
      alert("Error triggering notification: " + err.message);
    }
  };

  const handleCheckboxChange = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBatchUpdate = async (isRead: boolean) => {
    if (selectedIds.length === 0) {
      alert("No notifications selected.");
      return;
    }
    try {
      await batchUpdateNotificationStatus({ ids: selectedIds, isRead });
      setSelectedIds([]);
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1>Notification Center</h1>
          {user && <p>Logged in as: <strong>{getUsername(user as any) || user.id}</strong></p>}
          <p>Socket.IO Status: <span style={{ color: isConnected ? "green" : "red" }}>{isConnected ? "Connected" : "Disconnected"}</span></p>
        </div>
        <button data-testid="logout-btn" onClick={logout} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          Logout
        </button>
      </header>

      {/* Preferences Section */}
      <section style={{ border: "1px solid #ccc", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
        <h2>Notification Preferences</h2>
        {isPrefLoading ? (
          <p>Loading preferences...</p>
        ) : (
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="pref-system"
                  checked={systemEnabled}
                  onChange={(e) => setSystemEnabled(e.target.checked)}
                />
                System Notifications
              </label>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="pref-security"
                  checked={securityEnabled}
                  onChange={(e) => setSecurityEnabled(e.target.checked)}
                />
                Security Notifications
              </label>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="pref-activity"
                  checked={activityEnabled}
                  onChange={(e) => setActivityEnabled(e.target.checked)}
                />
                Activity Notifications
              </label>
            </div>
            <button
              data-testid="save-pref-btn"
              onClick={handleSavePreferences}
              style={{ padding: "0.5rem 1rem", cursor: "pointer", backgroundColor: "#0070f3", color: "#fff", border: "none", borderRadius: "4px" }}
            >
              Save Preferences
            </button>
          </div>
        )}
      </section>

      {/* Trigger Notification Form */}
      <section style={{ border: "1px solid #ccc", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
        <h2>Trigger Notification Event</h2>
        <form onSubmit={handleTriggerNotification}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Notification Type:</label>
            <select
              data-testid="trigger-type"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as any)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px" }}
            >
              <option value="SYSTEM">SYSTEM</option>
              <option value="SECURITY">SECURITY</option>
              <option value="ACTIVITY">ACTIVITY</option>
            </select>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Title:</label>
            <input
              type="text"
              data-testid="trigger-title"
              value={triggerTitle}
              onChange={(e) => setTriggerTitle(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Message:</label>
            <textarea
              data-testid="trigger-message"
              value={triggerMessage}
              onChange={(e) => setTriggerMessage(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box", borderRadius: "4px", border: "1px solid #ccc", minHeight: "80px" }}
            />
          </div>
          <button
            type="submit"
            data-testid="trigger-btn"
            style={{ padding: "0.5rem 1rem", cursor: "pointer", backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "4px" }}
          >
            Trigger Event
          </button>
        </form>
      </section>

      {/* Real-Time Alerts List */}
      <section style={{ border: "1px solid #ccc", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem", backgroundColor: "#f9fafb" }}>
        <h2>Real-Time Alerts (Live Socket.IO)</h2>
        <div data-testid="realtime-alerts" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {realtimeAlerts.length === 0 ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>No real-time alerts received yet.</p>
          ) : (
            realtimeAlerts.map((alert, index) => (
              <div
                key={index}
                data-testid="alert-item"
                style={{ padding: "0.75rem", borderLeft: "4px solid #3b82f6", backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
              >
                <div style={{ fontWeight: "bold" }}>{alert.title}</div>
                <div>{alert.message}</div>
                <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>Type: {alert.type}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Stored Notifications List */}
      <section style={{ border: "1px solid #ccc", padding: "1.5rem", borderRadius: "8px" }}>
        <h2>Stored Notifications (Historical Query)</h2>
        {isNotificationsLoading ? (
          <p>Loading notifications...</p>
        ) : (
          <div>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <button
                data-testid="mark-read-btn"
                onClick={() => handleBatchUpdate(true)}
                disabled={selectedIds.length === 0}
                style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
              >
                Mark Selected as Read
              </button>
              <button
                data-testid="mark-unread-btn"
                onClick={() => handleBatchUpdate(false)}
                disabled={selectedIds.length === 0}
                style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
              >
                Mark Selected as Unread
              </button>
            </div>

            <div data-testid="notifications-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {!notifications || notifications.length === 0 ? (
                <p style={{ color: "#666", fontStyle: "italic" }}>No notifications stored in database.</p>
              ) : (
                notifications.map((notification: any) => (
                  <div
                    key={notification.id}
                    data-testid="notification-item"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                      padding: "1rem",
                      border: "1px solid #eee",
                      borderRadius: "6px",
                      backgroundColor: notification.isRead ? "#f3f4f6" : "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      data-testid="notification-checkbox"
                      data-notification-id={notification.id}
                      checked={selectedIds.includes(notification.id)}
                      onChange={(e) => handleCheckboxChange(notification.id, e.target.checked)}
                      style={{ marginTop: "0.25rem", cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 data-testid="notification-title" style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>
                        {notification.title}
                      </h3>
                      <p data-testid="notification-message" style={{ margin: "0 0 0.5rem 0", color: "#374151" }}>
                        {notification.message}
                      </p>
                      <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "#6b7280" }}>
                        <span>
                          Type: <strong data-testid="notification-type">{notification.type}</strong>
                        </span>
                        <span>
                          Status: <strong data-testid="notification-status">{notification.isRead ? "Read" : "Unread"}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
