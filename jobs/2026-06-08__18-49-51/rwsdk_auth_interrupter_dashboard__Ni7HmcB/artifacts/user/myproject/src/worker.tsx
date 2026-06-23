import { route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { setCommonHeaders } from "@/app/headers";
import { loginPageHtml } from "@/app/pages/login";
import { dashboardPageHtml } from "@/app/pages/dashboard";
import { validateCredentials, isAuthenticated } from "@/app/auth";
import { createSessionCookie, clearSessionCookie } from "@/app/session";

export type AppContext = {
  username?: string;
};

const HTML = "text/html; charset=utf-8";

export default defineApp([
  setCommonHeaders(),

  // GET / — public landing page
  route("/", {
    get: () =>
      new Response(
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Home</title></head><body><h1>Welcome</h1><p><a href="/login">Login</a> | <a href="/dashboard">Dashboard</a></p></body></html>`,
        { status: 200, headers: { "Content-Type": HTML } }
      ),
  }),

  // GET /login — render login form
  // POST /login — validate credentials and create a signed session cookie
  route("/login", {
    get: () =>
      new Response(loginPageHtml(), {
        status: 200,
        headers: { "Content-Type": HTML },
      }),

    post: async ({ request }) => {
      const body = await request.formData();
      const username = (body.get("username") as string) ?? "";
      const password = (body.get("password") as string) ?? "";

      const validUser = validateCredentials(username, password);
      if (!validUser) {
        return new Response(loginPageHtml("Invalid username or password."), {
          status: 401,
          headers: { "Content-Type": HTML },
        });
      }

      const cookieHeader = await createSessionCookie(validUser);
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/dashboard",
          "Set-Cookie": cookieHeader,
        },
      });
    },
  }),

  // GET /dashboard — protected by isAuthenticated interrupter
  route("/dashboard", [
    isAuthenticated,
    ({ ctx }: { ctx: AppContext }) =>
      new Response(dashboardPageHtml(ctx.username!), {
        status: 200,
        headers: { "Content-Type": HTML },
      }),
  ]),

  // POST /logout — clear the session cookie and redirect to /login
  route("/logout", {
    post: () =>
      new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
          "Set-Cookie": clearSessionCookie(),
        },
      }),
  }),
]);
