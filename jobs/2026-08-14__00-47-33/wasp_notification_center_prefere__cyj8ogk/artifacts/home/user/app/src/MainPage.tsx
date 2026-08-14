import { useState, useEffect } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import {
  useQuery,
  useAction,
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  triggerNotificationEvent,
  batchUpdateNotificationStatus,
} from "wasp/client/operations";

export function MainPage() {
  const { data: user } = useAuth();
  const { isConnected } = useSocket();

  // Queries
  const { data: preferences } = useQuery(getNotificationPreferences);
  const { data: notifications = [] } = useQuery(getNotifications);

  // Actions
  const updatePreferences = useAction(updateNotificationPreferences);
  const triggerNotification = useAction(triggerNotificationEvent);
  const batchUpdateStatus = useAction(batchUpdateNotificationStatus);

  // Preferences local state
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [activityEnabled, setActivityEnabled] = useState(true);

  // Trigger form local state
  const [triggerType, setTriggerType] = useState<"SYSTEM" | "SECURITY" | "ACTIVITY">("SYSTEM");
  const [triggerTitle, setTriggerTitle] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");

  // Real-time alerts local state
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  // Selected notifications for batch actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Sync preferences local state with database
  useEffect(() => {
    if (preferences) {
      setSystemEnabled(preferences.systemEnabled);
      setSecurityEnabled(preferences.securityEnabled);
      setActivityEnabled(preferences.activityEnabled);
    }
  }, [preferences]);

  // Listen to real-time notification events
  useSocketListener("notification", (newNotification: any) => {
    setRealtimeAlerts((prev) => [newNotification, ...prev]);
  });

  const handleSavePreferences = async () => {
    try {
      await updatePreferences({
        systemEnabled,
        securityEnabled,
        activityEnabled,
      });
      alert("Preferences saved successfully!");
    } catch (err: any) {
      alert("Failed to save preferences: " + err.message);
    }
  };

  const handleTriggerNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerTitle.trim() || !triggerMessage.trim()) {
      alert("Please fill in both title and message");
      return;
    }
    try {
      const result = await triggerNotification({
        type: triggerType,
        title: triggerTitle,
        message: triggerMessage,
      });
      if (result.created) {
        setTriggerTitle("");
        setTriggerMessage("");
      } else {
        alert("Notification was not created because this preference type is disabled.");
      }
    } catch (err: any) {
      alert("Failed to trigger notification: " + err.message);
    }
  };

  const handleCheckboxChange = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchUpdate = async (isRead: boolean) => {
    if (selectedIds.length === 0) {
      alert("Please select at least one notification");
      return;
    }
    try {
      await batchUpdateStatus({
        ids: selectedIds,
        isRead,
      });
      setSelectedIds([]);
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Notification Center</h1>
          <p style={{ margin: "5px 0 0", color: "#666" }}>
            Logged in as: <strong>{user?.identities?.username?.id || "User"}</strong>
          </p>
          <div style={{ fontSize: "12px", color: isConnected ? "green" : "red", marginTop: "5px" }}>
            WebSocket Connection: {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
        <button
          data-testid="logout-btn"
          onClick={logout}
          style={{ padding: "8px 16px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Left Column: Preferences and Trigger Form */}
        <div>
          {/* Preferences Section */}
          <section style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "15px", marginBottom: "20px" }}>
            <h2 style={{ marginTop: 0, fontSize: "18px" }}>Notification Preferences</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="pref-system"
                  checked={systemEnabled}
                  onChange={(e) => setSystemEnabled(e.target.checked)}
                />
                System Notifications
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  data-testid="pref-security"
                  checked={securityEnabled}
                  onChange={(e) => setSecurityEnabled(e.target.checked)}
                />
                Security Notifications
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
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
              style={{ padding: "8px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", width: "100%" }}
            >
              Save Preferences
            </button>
          </section>

          {/* Trigger Notification Form */}
          <section style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "15px" }}>
            <h2 style={{ marginTop: 0, fontSize: "18px" }}>Trigger Test Notification</h2>
            <form onSubmit={handleTriggerNotification} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold" }}>Type</label>
                <select
                  data-testid="trigger-type"
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="SYSTEM">SYSTEM</option>
                  <option value="SECURITY">SECURITY</option>
                  <option value="ACTIVITY">ACTIVITY</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold" }}>Title</label>
                <input
                  type="text"
                  data-testid="trigger-title"
                  value={triggerTitle}
                  onChange={(e) => setTriggerTitle(e.target.value)}
                  placeholder="Enter notification title"
                  style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold" }}>Message</label>
                <textarea
                  data-testid="trigger-message"
                  value={triggerMessage}
                  onChange={(e) => setTriggerMessage(e.target.value)}
                  placeholder="Enter notification message"
                  rows={3}
                  style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                data-testid="trigger-btn"
                style={{ padding: "10px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              >
                Trigger Notification
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Real-Time Alerts and Stored Notifications */}
        <div>
          {/* Real-Time Alerts List */}
          <section style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "15px", marginBottom: "20px", backgroundColor: "#f9f9f9" }}>
            <h2 style={{ marginTop: 0, fontSize: "18px" }}>Real-Time Alerts (WebSocket)</h2>
            <div
              data-testid="realtime-alerts"
              style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "200px", overflowY: "auto", padding: "5px", border: "1px dashed #ccc", borderRadius: "4px", backgroundColor: "white" }}
            >
              {realtimeAlerts.length === 0 ? (
                <p style={{ margin: 0, color: "#999", fontSize: "14px", textAlign: "center", padding: "10px" }}>
                  No real-time alerts received yet.
                </p>
              ) : (
                realtimeAlerts.map((alert, index) => (
                  <div
                    key={index}
                    data-testid="alert-item"
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      borderLeft: "4px solid #2196F3",
                      backgroundColor: "#e3f2fd",
                      fontSize: "14px",
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>[{alert.type}] {alert.title}</div>
                    <div style={{ marginTop: "4px" }}>{alert.message}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Stored Notifications List */}
          <section style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Stored Notifications</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  data-testid="mark-read-btn"
                  onClick={() => handleBatchUpdate(true)}
                  style={{ padding: "6px 12px", backgroundColor: "#e0e0e0", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
                  Mark Read
                </button>
                <button
                  data-testid="mark-unread-btn"
                  onClick={() => handleBatchUpdate(false)}
                  style={{ padding: "6px 12px", backgroundColor: "#e0e0e0", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
                  Mark Unread
                </button>
              </div>
            </div>

            <div
              data-testid="notifications-list"
              style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}
            >
              {notifications.length === 0 ? (
                <p style={{ margin: 0, color: "#999", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                  No historical notifications.
                </p>
              ) : (
                notifications.map((notification: any) => (
                  <div
                    key={notification.id}
                    data-testid="notification-item"
                    style={{
                      display: "flex",
                      gap: "10px",
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #eee",
                      backgroundColor: notification.isRead ? "#fafafa" : "#fff",
                      borderLeft: notification.isRead ? "4px solid #ccc" : "4px solid #f44336",
                    }}
                  >
                    <input
                      type="checkbox"
                      data-testid="notification-checkbox"
                      data-notification-id={notification.id}
                      checked={selectedIds.includes(notification.id)}
                      onChange={() => handleCheckboxChange(notification.id)}
                      style={{ cursor: "pointer" }}
                    />
                    <div style={{ flex: 1, fontSize: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span data-testid="notification-title" style={{ fontWeight: "bold" }}>
                          {notification.title}
                        </span>
                        <span
                          data-testid="notification-type"
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            backgroundColor: "#eee",
                            color: "#666",
                          }}
                        >
                          {notification.type}
                        </span>
                      </div>
                      <p data-testid="notification-message" style={{ margin: "5px 0", color: "#444" }}>
                        {notification.message}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#888" }}>
                        <span data-testid="notification-status">
                          {notification.isRead ? "Read" : "Unread"}
                        </span>
                        <span>{new Date(notification.createdAt).toLocaleString()}</span>
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
