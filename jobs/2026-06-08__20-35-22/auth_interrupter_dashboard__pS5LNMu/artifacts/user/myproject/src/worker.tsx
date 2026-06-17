import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { isAuthenticated } from "@/app/auth/isAuthenticated";
import { createSessionValue, getSessionUsername } from "@/app/auth/session";
import { authenticate } from "@/app/auth/users";

export type AppContext = {
  username?: string;
};

/** GET /login — renders the login form, optionally with an error message */
function loginPage(errorMsg?: string): Response {
  const errorHtml = errorMsg
    ? `<p style="color: red;">${errorMsg}</p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login</title>
</head>
<body>
  <h1>Login</h1>
  ${errorHtml}
  <form method="post" action="/login">
    <div>
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required />
    </div>
    <div>
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required />
    </div>
    <button type="submit">Login</button>
  </form>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** GET /dashboard — shows the authenticated user's username */
function dashboardPage(username: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dashboard</title>
</head>
<body>
  <h1>Dashboard</h1>
  <p>Welcome, ${username}!</p>
  <form method="post" action="/logout">
    <button type="submit">Logout</button>
  </form>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", Home)]),

  // /login — GET shows the form, POST authenticates
  route("/login", {
    get: () => loginPage(),
    post: async ({ request }: { request: Request }) => {
      const formData = await request.formData();
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;

      const authenticatedUser = authenticate(username, password);
      if (!authenticatedUser) {
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login</title>
</head>
<body>
  <h1>Login</h1>
  <p style="color: red;">Invalid username or password</p>
  <form method="post" action="/login">
    <div>
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required />
    </div>
    <div>
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required />
    </div>
    <button type="submit">Login</button>
  </form>
</body>
</html>`,
          {
            status: 401,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      // Create signed session cookie
      const sessionValue = await createSessionValue(authenticatedUser);
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/dashboard",
          "Set-Cookie": `session=${sessionValue}; HttpOnly; Path=/`,
        },
      });
    },
  }),

  // GET /dashboard — protected by isAuthenticated interrupter
  route("/dashboard", [
    isAuthenticated,
    ({ ctx }: { ctx: AppContext }) => {
      return dashboardPage(ctx.username!);
    },
  ]),

  // POST /logout — clear session and redirect to login
  route("/logout", {
    post: async ({ request }: { request: Request }) => {
      // Always redirect to /login, clearing any session cookie
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
          "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
        },
      });
    },
  }),
]);