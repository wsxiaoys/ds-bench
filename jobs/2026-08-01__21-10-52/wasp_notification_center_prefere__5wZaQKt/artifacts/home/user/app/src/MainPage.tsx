import { useState, useEffect } from "react";
import { useQuery, useAction } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { useSocket, useSocketListener } from "wasp/client/webSocket";
import {
  getNotifications,
  getNotificationPreferences,
} from "wasp/client/operations";
import {
  batchUpdateNotificationStatus,
  updateNotificationPreferences,
  triggerNotificationEvent,
} from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const { data: preferences, isLoading: prefLoading } = useQuery(getNotificationPreferences);
  const { data: notifications, isLoading: notificationsLoading } = useQuery(getNotifications);

  const updatePreferences = useAction(updateNotificationPreferences);
  const triggerNotification = useAction(triggerNotificationEvent);
  const batchUpdateStatus = useAction(batchUpdateNotificationStatus);

  // Preference Checkbox States
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

  // Trigger Notification Form States
  const [triggerType, setTriggerType] = useState<"SYSTEM" | "SECURITY" | "ACTIVITY">("SYSTEM");
  const [triggerTitle, setTriggerTitle] = useState("");
  const [triggerMessage, setTriggerMessage] = useState("");

  // Real-Time Alerts State
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  // Selected notifications for batch actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // WebSocket connection & listener
  const { isConnected } = useSocket();
  useSocketListener("notification", (newNotification: any) => {
    setRealtimeAlerts((prev) => [newNotification, ...prev]);
  });

  const handleSavePreferences = async () => {
    try {
      await updatePreferences({ systemEnabled, securityEnabled, activityEnabled });
      alert("Preferences saved successfully!");
    } catch (err: any) {
      alert("Failed to save preferences: " + err.message);
    }
  };

  const handleTriggerNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerTitle.trim() || !triggerMessage.trim()) {
      alert("Please fill in all fields.");
      return;
    }
    try {
      const res = await triggerNotification({
        type: triggerType,
        title: triggerTitle,
        message: triggerMessage,
      });
      if (res.created) {
        setTriggerTitle("");
        setTriggerMessage("");
      } else {
        alert("Notification not created because preference for this type is disabled.");
      }
    } catch (err: any) {
      alert("Failed to trigger notification: " + err.message);
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
      alert("Please select at least one notification.");
      return;
    }
    try {
      await batchUpdateStatus({ ids: selectedIds, isRead });
      setSelectedIds([]);
    } catch (err: any) {
      alert("Failed to update notifications: " + err.message);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>🔔 Real-Time Notification Center</h1>
        <div className="header-actions">
          <span className="ws-status">
            WS Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
          </span>
          <button onClick={logout} data-testid="logout-btn" className="btn btn-logout">
            Logout
          </button>
        </div>
      </header>

      <div className="grid">
        {/* Preferences Section */}
        <section className="card card-preferences">
          <h2>Notification Preferences</h2>
          {prefLoading ? (
            <p>Loading preferences...</p>
          ) : (
            <div className="pref-form">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={systemEnabled}
                  onChange={(e) => setSystemEnabled(e.target.checked)}
                  data-testid="pref-system"
                />
                System Notifications
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={securityEnabled}
                  onChange={(e) => setSecurityEnabled(e.target.checked)}
                  data-testid="pref-security"
                />
                Security Notifications
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={activityEnabled}
                  onChange={(e) => setActivityEnabled(e.target.checked)}
                  data-testid="pref-activity"
                />
                Activity Notifications
              </label>
              <button
                onClick={handleSavePreferences}
                data-testid="save-pref-btn"
                className="btn btn-primary"
              >
                Save Preferences
              </button>
            </div>
          )}
        </section>

        {/* Trigger Notification Form */}
        <section className="card card-trigger">
          <h2>Trigger Notification</h2>
          <form onSubmit={handleTriggerNotification} className="trigger-form">
            <div className="form-group">
              <label htmlFor="trigger-type">Type</label>
              <select
                id="trigger-type"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as any)}
                data-testid="trigger-type"
                className="form-control"
              >
                <option value="SYSTEM">SYSTEM</option>
                <option value="SECURITY">SECURITY</option>
                <option value="ACTIVITY">ACTIVITY</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="trigger-title">Title</label>
              <input
                id="trigger-title"
                type="text"
                value={triggerTitle}
                onChange={(e) => setTriggerTitle(e.target.value)}
                data-testid="trigger-title"
                className="form-control"
                placeholder="Enter title"
              />
            </div>
            <div className="form-group">
              <label htmlFor="trigger-message">Message</label>
              <textarea
                id="trigger-message"
                value={triggerMessage}
                onChange={(e) => setTriggerMessage(e.target.value)}
                data-testid="trigger-message"
                className="form-control"
                placeholder="Enter message"
                rows={3}
              />
            </div>
            <button type="submit" data-testid="trigger-btn" className="btn btn-primary">
              Trigger Notification
            </button>
          </form>
        </section>
      </div>

      <div className="grid">
        {/* Real-Time Alerts List */}
        <section className="card card-realtime">
          <h2>Real-Time Alerts</h2>
          <div data-testid="realtime-alerts" className="alerts-list">
            {realtimeAlerts.length === 0 ? (
              <p className="no-data">No real-time alerts received yet.</p>
            ) : (
              realtimeAlerts.map((alert, index) => (
                <div key={index} data-testid="alert-item" className={`alert-item ${alert.type.toLowerCase()}`}>
                  <div className="alert-header">
                    <span className="alert-type">{alert.type}</span>
                    <span className="alert-time">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="alert-title">{alert.title}</h4>
                  <p className="alert-msg">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Stored Notifications List */}
        <section className="card card-stored">
          <h2>Stored Notifications</h2>
          {notificationsLoading ? (
            <p>Loading historical notifications...</p>
          ) : (
            <div className="stored-container">
              <div className="batch-actions">
                <button
                  onClick={() => handleBatchUpdate(true)}
                  data-testid="mark-read-btn"
                  className="btn btn-secondary"
                  disabled={selectedIds.length === 0}
                >
                  Mark Selected as Read
                </button>
                <button
                  onClick={() => handleBatchUpdate(false)}
                  data-testid="mark-unread-btn"
                  className="btn btn-secondary"
                  disabled={selectedIds.length === 0}
                >
                  Mark Selected as Unread
                </button>
              </div>

              <div data-testid="notifications-list" className="notifications-list">
                {!notifications || notifications.length === 0 ? (
                  <p className="no-data">No stored notifications found.</p>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      data-testid="notification-item"
                      className={`notification-item ${notification.isRead ? "read" : "unread"}`}
                    >
                      <div className="notification-checkbox-container">
                        <input
                          type="checkbox"
                          data-testid="notification-checkbox"
                          data-notification-id={notification.id}
                          checked={selectedIds.includes(notification.id)}
                          onChange={(e) => handleCheckboxChange(notification.id, e.target.checked)}
                        />
                      </div>
                      <div className="notification-content">
                        <div className="notification-header">
                          <span data-testid="notification-type" className="notification-type">
                            {notification.type}
                          </span>
                          <span data-testid="notification-status" className="notification-status">
                            {notification.isRead ? "Read" : "Unread"}
                          </span>
                        </div>
                        <h4 data-testid="notification-title" className="notification-title">
                          {notification.title}
                        </h4>
                        <p data-testid="notification-message" className="notification-message">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
