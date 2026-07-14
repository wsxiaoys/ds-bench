import { layout, prefix, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { AdminDocument, PublicDocument } from "@/app/document";
import { AdminLayout, PublicLayout } from "@/app/layouts";
import { setCommonHeaders } from "@/app/headers";
import { HomePage } from "@/app/pages/home";
import { AboutPage } from "@/app/pages/about";
import { AdminDashboardPage } from "@/app/pages/admin-dashboard";
import { AdminUsersPage } from "@/app/pages/admin-users";
import { AdminSettingsPage } from "@/app/pages/admin-settings";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },

  // Public section — rendered inside the PublicDocument shell and wrapped by
  // the PublicLayout (public nav/header chrome).
  render(PublicDocument, [
    layout(PublicLayout, [
      route("/", HomePage),
      route("/about", AboutPage),
    ]),
  ]),

  // Admin section — rendered inside a *different* Document shell (AdminDocument)
  // and wrapped by the AdminLayout (admin nav/header chrome). All admin routes
  // are grouped under the /admin prefix and share the same admin layout.
  render(AdminDocument, [
    prefix(
      "/admin",
      layout(AdminLayout, [
        route("/", AdminDashboardPage),
        route("/users", AdminUsersPage),
        route("/settings", AdminSettingsPage),
      ]),
    ),
  ]),
]);