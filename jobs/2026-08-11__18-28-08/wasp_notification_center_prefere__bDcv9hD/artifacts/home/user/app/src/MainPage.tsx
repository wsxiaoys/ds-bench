import { useEffect, useState } from "react";
import { logout } from "wasp/client/auth";
import {
  useQuery,
  getNotifications,
  getNotificationPreferences,
  batchUpdateNotificationStatus,
  updateNotificationPreferences,
  triggerNotificationEvent,
} from "wasp/client/operations";
import { useSocket, useSocketListener } from "wasp/client/webSocket";

export function MainPage() {
  const { data: preferences, refetch: refetchPreferences } = useQuery(getNotificationPreferences);
  const { data: notifications, refetch: refetchNotifications } = useQuery(getNotifications);
  const { isConnected } = useSocket();

  const [systemEnabled, setSystemEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [activityEnabled, setActivityEnabled] = useState(true);

  const [triggerType, setTriggerType] = useState<"SYSTEM" | "SECURITY" | "ACTIVITY">("SYSTEM");
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

  useSocketListener("notification", (newNotification: any) => {
    setRealtimeAlerts((prev) => [newNotification, ...prev]);
    refetchNotifications();
  });

  const handleSavePreferences = async () => {
    try {
      await updateNotificationPreferences({
        systemEnabled,
        securityEnabled,
        activityEnabled,
      });
      alert("Preferences saved successfully!");
      refetchPreferences();
    } catch (err: any) {
      alert("Error saving preferences: " + err.message);
    }
  };

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerTitle || !triggerMessage) {
      alert("Please fill out title and message.");
      return;
    }
    try {
      const res = await triggerNotificationEvent({
        type: triggerType,
        title: triggerTitle,
        message: triggerMessage,
      });
      if (res.created) {
        alert("Notification triggered and created successfully!");
      } else {
        alert("Notification triggered but ignored due to preferences.");
      }
      setTriggerTitle("");
      setTriggerMessage("");
      refetchNotifications();
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

  const handleMarkRead = async () => {
    if (selectedIds.length === 0) {
      alert("No notifications selected.");
      return;
    }
    try {
      await batchUpdateNotificationStatus({ ids: selectedIds, isRead: true });
      setSelectedIds([]);
      refetchNotifications();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  const handleMarkUnread = async () => {
    if (selectedIds.length === 0) {
      alert("No notifications selected.");
      return;
    }
    try {
      await batchUpdateNotificationStatus({ ids: selectedIds, isRead: false });
      setSelectedIds([]);
      refetchNotifications();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "1rem", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Real-Time Notification Center</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
            WebSocket status: <span style={{ fontWeight: "bold", color: isConnected ? "green" : "red" }}>{isConnected ? "Connected" : "Disconnected"}</span>
          </p>
        </div>
        <button
          data-testid="logout-btn"
          onClick={logout}
          style={{ padding: "0.5rem 1rem", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Left column: Preferences & Trigger */}
        <div>
          <section style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", marginBottom: "2rem", backgroundColor: "#f9f9f9" }}>
            <h2 style={{ marginTop: 0 }}>Notification Preferences</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="pref-system"
                  checked={systemEnabled}
                  onChange={(e) => setSystemEnabled(e.target.checked)}
                />
                System Notifications
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="pref-security"
                  checked={securityEnabled}
                  onChange={(e) => setSecurityEnabled(e.target.checked)}
                />
                Security Notifications
              </label>
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
              style={{ padding: "0.5rem 1rem", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
              Save Preferences
            </button>
          </section>

          <section style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", backgroundColor: "#f9f9f9" }}>
            <h2 style={{ marginTop: 0 }}>Trigger Notification</h2>
            <form onSubmit={handleTrigger} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontWeight: "bold" }}>Type</label>
                <select
                  data-testid="trigger-type"
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="SYSTEM">SYSTEM</option>
                  <option value="SECURITY">SECURITY</option>
                  <option value="ACTIVITY">ACTIVITY</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontWeight: "bold" }}>Title</label>
                <input
                  type="text"
                  data-testid="trigger-title"
                  value={triggerTitle}
                  onChange={(e) => setTriggerTitle(e.target.value)}
                  placeholder="Enter title"
                  style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontWeight: "bold" }}>Message</label>
                <textarea
                  data-testid="trigger-message"
                  value={triggerMessage}
                  onChange={(e) => setTriggerMessage(e.target.value)}
                  placeholder="Enter message"
                  rows={3}
                  style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc", resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                data-testid="trigger-btn"
                style={{ padding: "0.5rem 1rem", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                Trigger Notification
              </button>
            </form>
          </section>
        </div>

        {/* Right column: Real-Time Alerts & Stored Notifications */}
        <div>
          <section style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", marginBottom: "2rem", backgroundColor: "#fff" }}>
            <h2 style={{ marginTop: 0 }}>Real-Time Alerts (Socket.IO)</h2>
            <div
              data-testid="realtime-alerts"
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "300px", overflowY: "auto", border: "1px solid #eee", padding: "1rem", borderRadius: "4px", backgroundColor: "#fafafa" }}
            >
              {realtimeAlerts.length === 0 ? (
                <p style={{ margin: 0, color: "#999", textAlign: "center" }}>No real-time alerts received yet.</p>
              ) : (
                realtimeAlerts.map((alertItem, idx) => (
                  <div
                    key={alertItem.id || idx}
                    data-testid="alert-item"
                    style={{ padding: "0.75rem", borderLeft: "4px solid #4CAF50", backgroundColor: "#e8f5e9", borderRadius: "4px" }}
                  >
                    <div style={{ fontWeight: "bold" }}>{alertItem.title}</div>
                    <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{alertItem.message}</div>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>Type: {alertItem.type}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", backgroundColor: "#fff" }}>
            <h2 style={{ marginTop: 0 }}>Stored Notifications</h2>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <button
                data-testid="mark-read-btn"
                onClick={handleMarkRead}
                style={{ padding: "0.5rem 1rem", backgroundColor: "#9C27B0", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.9rem" }}
              >
                Mark Selected as Read
              </button>
              <button
                data-testid="mark-unread-btn"
                onClick={handleMarkUnread}
                style={{ padding: "0.5rem 1rem", backgroundColor: "#607D8B", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.9rem" }}
              >
                Mark Selected as Unread
              </button>
            </div>

            <div
              data-testid="notifications-list"
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", padding: "1rem", borderRadius: "4px", backgroundColor: "#fafafa" }}
            >
              {!notifications || notifications.length === 0 ? (
                <p style={{ margin: 0, color: "#999", textAlign: "center" }}>No notifications in database.</p>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    data-testid="notification-item"
                    style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "0.75rem", borderBottom: "1px solid #eee", backgroundColor: item.isRead ? "#f5f5f5" : "#fff" }}
                  >
                    <input
                      type="checkbox"
                      data-testid="notification-checkbox"
                      data-notification-id={item.id}
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => handleCheckboxChange(item.id, e.target.checked)}
                      style={{ marginTop: "0.25rem", cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div data-testid="notification-title" style={{ fontWeight: "bold", textDecoration: item.isRead ? "line-through" : "none", color: item.isRead ? "#888" : "#000" }}>
                        {item.title}
                      </div>
                      <div data-testid="notification-message" style={{ fontSize: "0.9rem", color: item.isRead ? "#888" : "#333", marginTop: "0.25rem" }}>
                        {item.message}
                      </div>
                      <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>
                        <span>Type: <span data-testid="notification-type" style={{ fontWeight: "bold" }}>{item.type}</span></span>
                        <span>Status: <span data-testid="notification-status" style={{ fontWeight: "bold", color: item.isRead ? "#777" : "#d32f2f" }}>{item.isRead ? "Read" : "Unread"}</span></span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
