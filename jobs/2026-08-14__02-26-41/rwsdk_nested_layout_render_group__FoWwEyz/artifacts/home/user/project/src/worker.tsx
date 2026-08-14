import { render, route, layout, prefix } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { PublicDocument, AdminDocument } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { PublicLayout, AdminLayout } from "@/app/layouts";
import { Home } from "@/app/pages/home";
import { About } from "@/app/pages/about";
import { AdminDashboard } from "@/app/pages/admin-dashboard";
import { AdminUsers } from "@/app/pages/admin-users";
import { AdminSettings } from "@/app/pages/admin-settings";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(PublicDocument, layout(PublicLayout, [
    route("/", Home),
    route("/about", About),
  ])),
  render(AdminDocument, layout(AdminLayout, prefix("/admin", [
    route("/", AdminDashboard),
    route("/users", AdminUsers),
    route("/settings", AdminSettings),
  ]))),
]);
