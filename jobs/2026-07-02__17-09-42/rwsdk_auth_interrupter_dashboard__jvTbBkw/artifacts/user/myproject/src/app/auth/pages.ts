import type { AppContext } from "@/worker";
import {
  buildClearSessionCookie,
  buildSessionSetCookie,
} from "@/app/auth/session";
import { findUser } from "@/app/auth/users";

import type { RequestInfo } from "rwsdk/worker";

const htmlShell = (title: string, body: string) =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
${body}
  </body>
</html>`;

export function homePage(): Response {
  const body = `
    <h1>RedwoodSDK Auth Demo</h1>
    <p>Welcome. <a href="/login">Sign in</a> to reach the dashboard.</p>
  `;
  return new Response(htmlShell("RedwoodSDK Auth Demo", body), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function loginPage(errorMessage?: string): Response {
  const errorBlock = errorMessage
    ? `<p class="error" data-testid="login-error">${errorMessage}</p>`
    : "";
  const body = `
    <h1>Sign in</h1>
    ${errorBlock}
    <form method="post" action="/login">
      <label>
        Username
        <input type="text" name="username" required />
      </label>
      <label>
        Password
        <input type="password" name="password" required />
      </label>
      <button type="submit">Sign in</button>
    </form>
  `;
  return new Response(htmlShell("Sign in", body), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function loginSubmit({ request }: RequestInfo): Promise<Response> {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!username || !password || !findUser(username, password)) {
    // Status 401 + re-rendered form. Explicitly no Set-Cookie so an
    // attacker cannot establish a session through a failed login.
    return new Response(
      htmlShell(
        "Sign in",
        `
        <h1>Sign in</h1>
        <p class="error" data-testid="login-error">Invalid username or password.</p>
        <form method="post" action="/login">
          <label>
            Username
            <input type="text" name="username" required value="${escapeHtml(username)}" />
          </label>
          <label>
            Password
            <input type="password" name="password" required />
          </label>
          <button type="submit">Sign in</button>
        </form>
      `,
      ),
      {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const setCookie = await buildSessionSetCookie(username);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/dashboard",
      "Set-Cookie": setCookie,
    },
  });
}

export async function logout({ request }: RequestInfo): Promise<Response> {
  // Always clear the cookie on logout, regardless of whether one was sent.
  void request;
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Set-Cookie": buildClearSessionCookie(),
    },
  });
}

export function dashboardPage({ ctx }: RequestInfo<any, AppContext>): Response {
  const username = ctx.user?.username ?? "anonymous";
  const body = `
    <h1>Dashboard</h1>
    <p>Hello, <strong data-testid="dashboard-username">${escapeHtml(username)}</strong>!</p>
    <form method="post" action="/logout">
      <button type="submit">Sign out</button>
    </form>
  `;
  return new Response(htmlShell("Dashboard", body), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}