import { useState, useEffect } from "react";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import { logout } from "wasp/client/auth";
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
  const { isConnected } = useSocket();

  // Fetch queries
  const { data: preferences, isError: isPrefError } = useQuery(getNotificationPreferences);
  const { data: notifications, isError: isNotifError } = useQuery(getNotifications);

  // Preference state
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [activityEnabled, setActivityEnabled] = useState(true);

  // Initialize preference state when loaded
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

  // Real-time alerts list
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  // Selected notifications for batch actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Listen for real-time notifications
  useSocketListener("notification", (newNotification: any) => {
    setRealtimeAlerts((prev) => [newNotification, ...prev]);
  });

  // Action handlers
  const handleSavePreferences = async () => {
    try {
      await updateNotificationPreferences({
        systemEnabled,
        securityEnabled,
        activityEnabled,
      });
      alert("Preferences saved successfully!");
    } catch (error: any) {
      alert("Error saving preferences: " + error.message);
    }
  };

  const handleTriggerNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerTitle || !triggerMessage) {
      alert("Please fill in both title and message.");
      return;
    }
    try {
      const res = await triggerNotificationEvent({
        type: triggerType,
        title: triggerTitle,
        message: triggerMessage,
      });
      if (res.created) {
        // Clear fields
        setTriggerTitle("");
        setTriggerMessage("");
      } else {
        alert("Notification was not created because the preference for this type is disabled.");
        setTriggerTitle("");
        setTriggerMessage("");
      }
    } catch (error: any) {
      alert("Error triggering notification: " + error.message);
    }
  };

  const handleCheckboxChange = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleMarkRead = async () => {
    if (selectedIds.length === 0) return;
    try {
      await batchUpdateNotificationStatus({ ids: selectedIds, isRead: true });
      setSelectedIds([]);
    } catch (error: any) {
      alert("Error marking as read: " + error.message);
    }
  };

  const handleMarkUnread = async () => {
    if (selectedIds.length === 0) return;
    try {
      await batchUpdateNotificationStatus({ ids: selectedIds, isRead: false });
      setSelectedIds([]);
    } catch (error: any) {
      alert("Error marking as unread: " + error.message);
    }
  };

  return (
    <main className="container" style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Real-Time Notification Center</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <span style={{ fontSize: "14px", color: isConnected ? "green" : "red" }}>
            ● {isConnected ? "Connected" : "Disconnected"}
          </span>
          <button data-testid="logout-btn" onClick={logout} className="button button-outlined">
            Logout
          </button>
        </div>
      </header>

      {/* Preferences Section */}
      <section style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Notification Preferences</h3>
        {isPrefError ? (
          <p style={{ color: "red" }}>Failed to load preferences.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                data-testid="pref-system"
                checked={systemEnabled}
                onChange={(e) => setSystemEnabled(e.target.checked)}
              />
              System Notifications
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                data-testid="pref-security"
                checked={securityEnabled}
                onChange={(e) => setSecurityEnabled(e.target.checked)}
              />
              Security Notifications
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                data-testid="pref-activity"
                checked={activityEnabled}
                onChange={(e) => setActivityEnabled(e.target.checked)}
              />
              Activity Notifications
            </label>
            <button
              data-testid="save-pref-btn"
              onClick={handleSavePreferences}
              className="button button-filled"
              style={{ width: "fit-content", marginTop: "10px" }}
            >
              Save Preferences
            </button>
          </div>
        )}
      </section>

      {/* Trigger Notification Form */}
      <section style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Trigger Notification Event</h3>
        <form onSubmit={handleTriggerNotification} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label htmlFor="trigger-type">Type</label>
            <select
              id="trigger-type"
              data-testid="trigger-type"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as any)}
              style={{ padding: "8px", borderRadius: "4px" }}
            >
              <option value="SYSTEM">SYSTEM</option>
              <option value="SECURITY">SECURITY</option>
              <option value="ACTIVITY">ACTIVITY</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label htmlFor="trigger-title">Title</label>
            <input
              id="trigger-title"
              type="text"
              data-testid="trigger-title"
              value={triggerTitle}
              onChange={(e) => setTriggerTitle(e.target.value)}
              placeholder="Notification Title"
              style={{ padding: "8px", borderRadius: "4px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label htmlFor="trigger-message">Message</label>
            <textarea
              id="trigger-message"
              data-testid="trigger-message"
              value={triggerMessage}
              onChange={(e) => setTriggerMessage(e.target.value)}
              placeholder="Notification Message"
              style={{ padding: "8px", borderRadius: "4px", minHeight: "60px" }}
            />
          </div>
          <button
            type="submit"
            data-testid="trigger-btn"
            className="button button-filled"
            style={{ width: "fit-content" }}
          >
            Trigger Notification
          </button>
        </form>
      </section>

      {/* Real-Time Alerts List */}
      <section style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Real-Time Alerts (Socket.IO)</h3>
        <div
          data-testid="realtime-alerts"
          style={{
            maxHeight: "200px",
            overflowY: "auto",
            border: "1px solid #eee",
            borderRadius: "4px",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            backgroundColor: "#fcfcfc",
          }}
        >
          {realtimeAlerts.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>No real-time alerts received yet.</p>
          ) : (
            realtimeAlerts.map((alert, idx) => (
              <div
                key={idx}
                data-testid="alert-item"
                style={{
                  padding: "8px",
                  borderLeft: "4px solid #007bff",
                  backgroundColor: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <strong>[{alert.type}] {alert.title}</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>{alert.message}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Stored Notifications List */}
      <section style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px" }}>
        <h3>Stored Notifications (History)</h3>
        {isNotifError ? (
          <p style={{ color: "red" }}>Failed to load notifications.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {/* Batch Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                data-testid="mark-read-btn"
                onClick={handleMarkRead}
                disabled={selectedIds.length === 0}
                className="button button-filled"
                style={{ opacity: selectedIds.length === 0 ? 0.6 : 1 }}
              >
                Mark Read
              </button>
              <button
                data-testid="mark-unread-btn"
                onClick={handleMarkUnread}
                disabled={selectedIds.length === 0}
                className="button button-outlined"
                style={{ opacity: selectedIds.length === 0 ? 0.6 : 1 }}
              >
                Mark Unread
              </button>
            </div>

            <div
              data-testid="notifications-list"
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {!notifications || notifications.length === 0 ? (
                <p style={{ color: "#888" }}>No historical notifications found.</p>
              ) : (
                notifications.map((item: any) => (
                  <div
                    key={item.id}
                    data-testid="notification-item"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "10px",
                      border: "1px solid #eee",
                      borderRadius: "4px",
                      backgroundColor: item.isRead ? "#f9f9f9" : "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      data-testid="notification-checkbox"
                      data-notification-id={item.id}
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => handleCheckboxChange(item.id, e.target.checked)}
                      style={{ marginTop: "4px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong data-testid="notification-title">{item.title}</strong>
                        <span
                          data-testid="notification-type"
                          style={{
                            fontSize: "12px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "#eee",
                          }}
                        >
                          {item.type}
                        </span>
                      </div>
                      <p data-testid="notification-message" style={{ margin: "6px 0", fontSize: "14px" }}>
                        {item.message}
                      </p>
                      <span
                        data-testid="notification-status"
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: item.isRead ? "#888" : "#28a745",
                        }}
                      >
                        {item.isRead ? "Read" : "Unread"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
