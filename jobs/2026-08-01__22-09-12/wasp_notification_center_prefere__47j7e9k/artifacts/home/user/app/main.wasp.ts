import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { getNotifications } from "./src/operations" with { type: "ref" };
import { batchUpdateNotificationStatus } from "./src/operations" with { type: "ref" };
import { getNotificationPreferences } from "./src/operations" with { type: "ref" };
import { updateNotificationPreferences } from "./src/operations" with { type: "ref" };
import { triggerNotificationEvent } from "./src/operations" with { type: "ref" };
import { webSocketFn } from "./src/webSocket" with { type: "ref" };

export default app({
  name: "app",
  title: "Notification Center",
  wasp: { version: "^0.24.0" },
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  webSocket: {
    fn: webSocketFn,
    autoConnect: true,
  },
  spec: [
    route("MainRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    query(getNotifications, { entities: ["Notification"] }),
    action(batchUpdateNotificationStatus, { entities: ["Notification"] }),
    query(getNotificationPreferences, { entities: ["NotificationPreference"] }),
    action(updateNotificationPreferences, { entities: ["NotificationPreference", "User"] }),
    action(triggerNotificationEvent, { entities: ["Notification", "NotificationPreference", "User"] }),
  ],
});
