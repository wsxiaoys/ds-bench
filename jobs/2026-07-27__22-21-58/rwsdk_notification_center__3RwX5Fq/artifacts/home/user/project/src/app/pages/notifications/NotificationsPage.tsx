import { listNotifications } from "@/notifications/store";

import { NotificationsCenter } from "./NotificationsCenter";

export async function NotificationsPage() {
  const notifications = await listNotifications();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Notification Center</h1>
      <NotificationsCenter initialNotifications={notifications} />
    </main>
  );
}
