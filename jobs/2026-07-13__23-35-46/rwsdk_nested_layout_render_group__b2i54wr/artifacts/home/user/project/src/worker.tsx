import { render, route, prefix, layout } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { PublicDocument, AdminDocument } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { About } from "@/app/pages/about";
import { AdminDashboard } from "@/app/pages/admin-dashboard";
import { AdminUsers } from "@/app/pages/admin-users";
import { AdminSettings } from "@/app/pages/admin-settings";
import { PublicLayout, AdminLayout } from "@/app/shared/layouts";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  // Public Section Render Group
  render(PublicDocument, [
    layout(PublicLayout, [
      route("/", Home),
      route("/about", About),
    ]),
  ]),
  // Admin Section Render Group
  render(AdminDocument, [
    prefix("/admin", layout(AdminLayout, [
      route("/", AdminDashboard),
      route("/users", AdminUsers),
      route("/settings", AdminSettings),
    ])),
  ]),
]);
