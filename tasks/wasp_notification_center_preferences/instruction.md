# Real-Time Notification Center with Preferences in Wasp.sh

## Background
In modern web applications, real-time notifications are essential for keeping users engaged and informed. However, users must also have granular control over what notifications they receive to prevent alert fatigue. Wasp.sh (v0.24.0) provides built-in support for Socket.IO-based WebSockets alongside its full-stack Query/Action architecture. In this task, you will build a robust, real-time notification center that respects user preferences and supports batch status updates.

## Requirements

### 1. Database Schema (schema.prisma)
Define the following entities in your schema.prisma file:
- User entity:
  - Must have an autoincrementing integer id as primary key.
  - Must have a one-to-many relation to Notification.
  - Must have a one-to-one relation to NotificationPreference.
- Notification entity:
  - id: Autoincrementing integer primary key.
  - userId: Integer, foreign key to User.
  - type: String (one of 'SYSTEM', 'SECURITY', 'ACTIVITY').
  - title: String.
  - message: String.
  - isRead: Boolean, defaults to false.
  - createdAt: DateTime, defaults to now().
- NotificationPreference entity:
  - id: Autoincrementing integer primary key.
  - userId: Integer, unique, foreign key to User.
  - systemEnabled: Boolean, defaults to true.
  - securityEnabled: Boolean, defaults to true.
  - activityEnabled: Boolean, defaults to true.

### 2. Wasp Configuration (main.wasp.ts)
Configure the Wasp application spec with the following:
- Authentication: Enable usernameAndPassword auth, using User as the user entity, and redirecting failed authentication to /login.
- WebSockets: Enable WebSocket support with autoConnect: true, referencing a custom server-side function webSocketFn in src/webSocket.ts.
- Routes & Pages:
  - / -> MainPage (requires authentication).
  - /login -> LoginPage (public).
  - /signup -> SignupPage (public).
- Operations:
  - Query getNotifications (uses Notification entity).
  - Action batchUpdateNotificationStatus (uses Notification entity).
  - Query getNotificationPreferences (uses NotificationPreference entity).
  - Action updateNotificationPreferences (uses NotificationPreference and User entities).
  - Action triggerNotificationEvent (uses Notification, NotificationPreference, and User entities).

### 3. Server-Side Operations & WebSocket Integration
- WebSocket Setup (src/webSocket.ts):
  - Implement webSocketFn to initialize the Socket.IO server.
  - When a user connects, if they are authenticated, they should automatically join a Socket.IO room scoped to their user ID (e.g., user-${userId}).
  - Critical Seam: To allow server-side operations (like Actions) to emit WebSocket events, you must store a reference to the io server instance globally/module-level and export a helper/getter to retrieve it.
- Query getNotifications:
  - Returns all notifications for the authenticated user, ordered by createdAt descending.
- Action batchUpdateNotificationStatus:
  - Accepts { ids: number[], isRead: boolean }.
  - Updates the isRead status of all specified notifications belonging to the authenticated user, and returns the count of updated records.
- Query getNotificationPreferences:
  - Returns the NotificationPreference for the authenticated user.
  - If no preference record exists yet, the server must automatically create one with all preferences (systemEnabled, securityEnabled, activityEnabled) set to true and return it.
- Action updateNotificationPreferences:
  - Accepts { systemEnabled: boolean, securityEnabled: boolean, activityEnabled: boolean }.
  - Updates and returns the user's preferences.
- Action triggerNotificationEvent:
  - Accepts { type: 'SYSTEM' | 'SECURITY' | 'ACTIVITY', title: string, message: string }.
  - Checks the authenticated user's preferences. If the preference for the given type is enabled:
    - Creates a new Notification in the database.
    - Emits a real-time 'notification' event to the user's Socket.IO room/socket with the newly created Notification object as payload.
    - Returns { success: true, created: true }.
  - If the preference for the given type is disabled:
    - Does NOT create a notification in the database.
    - Does NOT emit any WebSocket event.
    - Returns { success: true, created: false }.

### 4. Client-Side UI & Test Hooks
Implement the pages with the following test hooks (data-testid) to ensure deterministic browser verification:
- Login Page (/login): Uses Wasp's built-in <LoginForm />.
- Signup Page (/signup): Uses Wasp's built-in <SignupForm />.
- Main Page (/):
  - Preferences Section:
    - Checkbox for System notifications: data-testid="pref-system"
    - Checkbox for Security notifications: data-testid="pref-security"
    - Checkbox for Activity notifications: data-testid="pref-activity"
    - Button to save preferences: data-testid="save-pref-btn"
  - Trigger Notification Form:
    - Select dropdown for type: data-testid="trigger-type" (options: 'SYSTEM', 'SECURITY', 'ACTIVITY')
    - Input field for title: data-testid="trigger-title"
    - Input field for message: data-testid="trigger-message"
    - Button to trigger notification: data-testid="trigger-btn"
  - Real-Time Alerts List:
    - A live list displaying notifications received instantly via Socket.IO: data-testid="realtime-alerts".
    - Each live alert should be rendered in an element with data-testid="alert-item".
  - Stored Notifications List:
    - A list of historical notifications fetched via query: data-testid="notifications-list".
    - Each item must be rendered in an element with data-testid="notification-item".
    - Within each item, display the title (data-testid="notification-title"), message (data-testid="notification-message"), type (data-testid="notification-type"), and status (data-testid="notification-status" as either 'Read' or 'Unread').
    - Each item must have a checkbox with data-testid="notification-checkbox" and a data-notification-id attribute set to its database ID.
    - Batch action buttons: data-testid="mark-read-btn" and data-testid="mark-unread-btn".
  - Logout Button: data-testid="logout-btn".

## Implementation Hints
- Project path: /home/user/app
- Start command: wasp start
- Port: 3000
- Ensure you run database migrations using wasp db migrate-dev before starting the application.
- Make sure all reference imports in main.wasp.ts use the correct with { type: "ref" } syntax.

