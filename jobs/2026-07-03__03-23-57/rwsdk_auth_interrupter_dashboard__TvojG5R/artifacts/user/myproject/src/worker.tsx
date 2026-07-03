import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { LoginPage } from "@/app/pages/login";
import { DashboardPage } from "@/app/pages/dashboard";
import { isAuthenticated } from "@/app/auth";
import { signSession } from "@/app/session";

export type AppContext = {
  username?: string;
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/login", {
      get: () => {
        return <LoginPage />;
      },
      post: async ({ request, response }) => {
        const formData = await request.formData();
        const username = formData.get("username")?.toString() || "";
        const password = formData.get("password")?.toString() || "";

        if (username === "demo" && password === "pass") {
          const sessionValue = signSession(username);
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/dashboard",
              "Set-Cookie": `session=${encodeURIComponent(sessionValue)}; HttpOnly; Path=/`,
            },
          });
        }

        // Invalid credentials: set status to 401 and re-render login page
        response.status = 401;
        return <LoginPage error="Invalid username or password" />;
      },
    }),
    route("/dashboard", [
      isAuthenticated,
      ({ ctx }) => {
        return <DashboardPage username={ctx.username || ""} />;
      },
    ]),
    route("/logout", {
      post: () => {
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/login",
            "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
          },
        });
      },
    }),
  ]),
]);
