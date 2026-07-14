import { render, route, layout, prefix } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { PublicDocument } from "@/app/documents/PublicDocument";
import { AdminDocument } from "@/app/documents/AdminDocument";
import { PublicLayout } from "@/app/layouts/PublicLayout";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import { setCommonHeaders } from "@/app/headers";

import { HomePage } from "@/app/pages/HomePage";
import { AboutPage } from "@/app/pages/AboutPage";
import { AdminDashboardPage } from "@/app/pages/admin/AdminDashboardPage";
import { AdminUsersPage } from "@/app/pages/admin/AdminUsersPage";
import { AdminSettingsPage } from "@/app/pages/admin/AdminSettingsPage";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  render(PublicDocument, [
    layout(PublicLayout, [
      route("/", HomePage),
      route("/about", AboutPage),
    ]),
  ]),
  render(AdminDocument, [
    prefix("/admin", [
      layout(AdminLayout, [
        route("/", AdminDashboardPage),
        route("/users", AdminUsersPage),
        route("/settings", AdminSettingsPage),
      ]),
    ]),
  ]),
]);
