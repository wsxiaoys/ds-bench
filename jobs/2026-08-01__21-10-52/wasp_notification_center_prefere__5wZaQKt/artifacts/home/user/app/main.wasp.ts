import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { LoginPage } from "./src/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/SignupPage" with { type: "ref" };
import { webSocketFn } from "./src/webSocket" with { type: "ref" };
import {
  getNotifications,
  getNotificationPreferences,
} from "./src/queries" with { type: "ref" };
import {
  batchUpdateNotificationStatus,
  updateNotificationPreferences,
  triggerNotificationEvent,
} from "./src/actions" with { type: "ref" };

export default app({
  name: "app",
  title: "app",
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
    route("RootRoute", "/", page(MainPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    query(getNotifications, { entities: ["Notification"] }),
    query(getNotificationPreferences, { entities: ["NotificationPreference"] }),
    action(batchUpdateNotificationStatus, { entities: ["Notification"] }),
    action(updateNotificationPreferences, { entities: ["NotificationPreference", "User"] }),
    action(triggerNotificationEvent, { entities: ["Notification", "NotificationPreference", "User"] }),
  ],
});
