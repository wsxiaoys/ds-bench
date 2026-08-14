import { useState, useEffect } from "react";
import { logout } from "wasp/client/auth";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import {
  useQuery,
  getNotifications,
  getNotificationPreferences,
  batchUpdateNotificationStatus,
  updateNotificationPreferences,
  triggerNotificationEvent,
} from "wasp/client/operations";

export function MainPage({ user }: { user: any }) {
  const { data: preferences, isLoading: isPrefLoading } = useQuery(getNotificationPreferences);
  const { data: notifications, isLoading: isNotifLoading } = useQuery(getNotifications);

  const [systemEnabled, setSystemEnabled] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [activityEnabled, setActivityEnabled] = useState(true);

  const [triggerType, setTriggerType] = useState<"SYSTEM" | "SECURITY" | "ACTIVITY" | string>("SYSTEM");
  const [triggerTitle, setTriggerTitle] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");

  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (preferences) {
      setSystemEnabled(preferences.systemEnabled);
      setSecurityEnabled(preferences.securityEnabled);
      setActivityEnabled(preferences.activityEnabled);
    }
  }, [preferences]);

  useSocketListener("notification", (newNotification: any) => {
    console.log("Received real-time notification:", newNotification);
    setRealtimeAlerts((prev) => [newNotification, ...prev]);
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

  const handleTriggerNotification = async () => {
    if (!triggerTitle.trim() || !triggerMessage.trim()) {
      alert("Please enter title and message.");
      return;
    }
    try {
      const res = await triggerNotificationEvent({
        type: triggerType as any,
        title: triggerTitle,
        message: triggerMessage,
      });
      if (res.created) {
        alert("Notification triggered and created successfully.");
      } else {
        alert("Notification triggered but filtered by preferences.");
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
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleBatchStatusUpdate = async (isRead: boolean) => {
    if (selectedIds.length === 0) {
      alert("Please select at least one notification.");
      return;
    }
    try {
      await batchUpdateNotificationStatus({
        ids: selectedIds,
        isRead,
      });
      setSelectedIds([]);
    } catch (err: any) {
      alert("Error updating notifications: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h1>Real-Time Notification Center</h1>
        <div>
          <span style={{ marginRight: "15px" }}>Logged in as: <strong>{user?.username || "User"}</strong></span>
          <button data-testid="logout-btn" onClick={logout} style={{ padding: "8px 16px", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
        {/* Preferences Section */}
        <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
          <h2>Notification Preferences</h2>
          {isPrefLoading ? (
            <p>Loading preferences...</p>
          ) : (
            <div>
              <div style={{ marginBottom: "10px" }}>
                <label>
                  <input
                    type="checkbox"
                    data-testid="pref-system"
                    checked={systemEnabled}
                    onChange={(e) => setSystemEnabled(e.target.checked)}
                  />{" "}
                  System Notifications
                </label>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label>
                  <input
                    type="checkbox"
                    data-testid="pref-security"
                    checked={securityEnabled}
                    onChange={(e) => setSecurityEnabled(e.target.checked)}
                  />{" "}
                  Security Notifications
                </label>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label>
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
                style={{ padding: "8px 16px", cursor: "pointer", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px" }}
              >
                Save Preferences
              </button>
            </div>
          )}
        </div>

        {/* Trigger Notification Form */}
        <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
          <h2>Trigger Notification</h2>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Type:</label>
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
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Title:</label>
            <input
              type="text"
              data-testid="trigger-title"
              value={triggerTitle}
              onChange={(e) => setTriggerTitle(e.target.value)}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              placeholder="Enter title"
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Message:</label>
            <textarea
              data-testid="trigger-message"
              value={triggerMessage}
              onChange={(e) => setTriggerMessage(e.target.value)}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              placeholder="Enter message"
              rows={3}
            />
          </div>
          <button
            data-testid="trigger-btn"
            onClick={handleTriggerNotification}
            style={{ padding: "8px 16px", cursor: "pointer", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px" }}
          >
            Trigger Notification
          </button>
        </div>
      </div>

      {/* Real-Time Alerts List */}
      <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px", marginBottom: "30px" }}>
        <h2>
          Real-Time Alerts{" "}
          <span style={{ fontSize: "14px", color: isConnected ? "green" : "red" }}>
            ({isConnected ? "Connected" : "Disconnected"})
          </span>
        </h2>
        <div data-testid="realtime-alerts" style={{ maxHeight: "200px", overflowY: "auto", background: "#f8f9fa", padding: "10px", borderRadius: "4px" }}>
          {realtimeAlerts.length === 0 ? (
            <p style={{ color: "#6c757d", margin: 0 }}>No real-time alerts received yet.</p>
          ) : (
            realtimeAlerts.map((alert: any, index: number) => (
              <div
                key={index}
                data-testid="alert-item"
                style={{ borderBottom: "1px solid #e9ecef", padding: "10px 0", display: "flex", justifyContent: "space-between" }}
              >
                <div>
                  <strong>[{alert.type}] {alert.title}</strong>
                  <p style={{ margin: "5px 0 0 0", color: "#495057" }}>{alert.message}</p>
                </div>
                <span style={{ fontSize: "12px", color: "#6c757d" }}>
                  {new Date(alert.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stored Notifications List */}
      <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
        <h2>Historical Notifications</h2>
        <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
          <button
            data-testid="mark-read-btn"
            onClick={() => handleBatchStatusUpdate(true)}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            Mark Selected as Read
          </button>
          <button
            data-testid="mark-unread-btn"
            onClick={() => handleBatchStatusUpdate(false)}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            Mark Selected as Unread
          </button>
        </div>

        {isNotifLoading ? (
          <p>Loading historical notifications...</p>
        ) : (
          <div data-testid="notifications-list">
            {notifications?.length === 0 ? (
              <p style={{ color: "#6c757d" }}>No notifications stored in database.</p>
            ) : (
              notifications?.map((notif: any) => (
                <div
                  key={notif.id}
                  data-testid="notification-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderBottom: "1px solid #eee",
                    padding: "10px 0",
                    background: notif.isRead ? "#fff" : "#f1f3f5",
                  }}
                >
                  <input
                    type="checkbox"
                    data-testid="notification-checkbox"
                    data-notification-id={notif.id}
                    checked={selectedIds.includes(notif.id)}
                    onChange={(e) => handleCheckboxChange(notif.id, e.target.checked)}
                    style={{ marginRight: "15px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span data-testid="notification-title" style={{ fontWeight: "bold" }}>
                        {notif.title}
                      </span>
                      <span
                        data-testid="notification-type"
                        style={{
                          fontSize: "12px",
                          background: "#e2e3e5",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {notif.type}
                      </span>
                      <span
                        data-testid="notification-status"
                        style={{
                          fontSize: "12px",
                          color: notif.isRead ? "#6c757d" : "#dc3545",
                          fontWeight: "bold",
                        }}
                      >
                        {notif.isRead ? "Read" : "Unread"}
                      </span>
                    </div>
                    <p data-testid="notification-message" style={{ margin: "5px 0 0 0", color: "#495057" }}>
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
