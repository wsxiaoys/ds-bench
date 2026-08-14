import { render, route, prefix, layout } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { setCommonHeaders } from "@/app/headers";
import { PublicDocument } from "@/app/documents/PublicDocument";
import { AdminDocument } from "@/app/documents/AdminDocument";
import { PublicLayout } from "@/app/layouts/PublicLayout";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import { Home } from "@/app/pages/home";
import { About } from "@/app/pages/About";
import { AdminDashboard } from "@/app/pages/AdminDashboard";
import { AdminUsers } from "@/app/pages/AdminUsers";
import { AdminSettings } from "@/app/pages/AdminSettings";

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
  render(AdminDocument, prefix("/admin", layout(AdminLayout, [
    route("/", AdminDashboard),
    route("/users", AdminUsers),
    route("/settings", AdminSettings),
  ]))),
]);
