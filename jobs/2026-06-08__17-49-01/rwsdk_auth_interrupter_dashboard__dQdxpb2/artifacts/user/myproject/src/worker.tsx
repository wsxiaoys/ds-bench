import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { Login } from "@/app/pages/login";
import { Dashboard } from "@/app/pages/dashboard";
import { isAuthenticated, DEMO_USER, signSession } from "@/app/auth";

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
    // GET / — any public landing page.
    route("/", Home),

    // GET /login — renders an HTML form that POSTs username and password to /login.
    // POST /login — accepts application/x-www-form-urlencoded body with fields username and password.
    route("/login", {
      get: () => {
        return <Login />;
      },
      post: async ({ request, response }) => {
        try {
          const formData = await request.formData();
          const username = formData.get("username")?.toString();
          const password = formData.get("password")?.toString();

          if (username === DEMO_USER.username && password === DEMO_USER.password) {
            const signedCookieValue = await signSession(username);
            return new Response(null, {
              status: 302,
              headers: {
                "Location": "/dashboard",
                "Set-Cookie": `session=${signedCookieValue}; HttpOnly; Path=/`,
              },
            });
          } else {
            response.status = 401;
            return <Login error="Invalid username or password" />;
          }
        } catch (error) {
          response.status = 400;
          return <Login error="Invalid request payload" />;
        }
      },
    }),

    // GET /dashboard — protected by an isAuthenticated interrupter.
    route("/dashboard", [
      isAuthenticated,
      ({ ctx }) => {
        return <Dashboard username={ctx.username || "Guest"} />;
      },
    ]),

    // POST /logout — clears the session cookie and redirects to /login.
    route("/logout", {
      post: () => {
        return new Response(null, {
          status: 302,
          headers: {
            "Location": "/login",
            "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0",
          },
        });
      },
    }),
  ]),
]);
