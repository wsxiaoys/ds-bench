import { layout, prefix, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { AdminDocument, PublicDocument } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import { PublicLayout } from "@/app/layouts/PublicLayout";
import { About } from "@/app/pages/About";
import { AdminDashboard } from "@/app/pages/AdminDashboard";
import { AdminSettings } from "@/app/pages/AdminSettings";
import { AdminUsers } from "@/app/pages/AdminUsers";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  render(PublicDocument, [
    layout(PublicLayout, [route("/", Home), route("/about", About)]),
  ]),
  render(AdminDocument, [
    prefix("/admin", [
      layout(AdminLayout, [
        route("/", AdminDashboard),
        route("/users", AdminUsers),
        route("/settings", AdminSettings),
      ]),
    ]),
  ]),
]);