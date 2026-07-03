import type { RequestInfo } from 'rwsdk/router';
import { findUser } from '@/app/auth/users';
import { createSessionToken, buildSessionCookie } from '@/app/auth/session';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLoginPage(errorMessage: string | null): string {
  const errorBlock = errorMessage
    ? `<div class="login-error" role="alert" style="color:#b00020;margin-bottom:1em;">${escapeHtml(errorMessage)}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Login</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 4rem REDACTED; padding: 0 1rem; }
      h1 { font-size: 1.5rem; margin-bottom: 1rem; }
      label { display: block; margin: 0.5rem 0 0.25rem; font-size: 0.9rem; }
      input[type=text], input[type=password] { width: 100%; padding: 0.5rem; font-size: 1rem; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
      button { margin-top: 1rem; padding: 0.6rem 1rem; font-size: 1rem; background: #1f6feb; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
      button:hover { background: #1858c4; }
      .hint { color: #666; font-size: 0.85rem; margin-top: 1rem; }
    </style>
  </head>
  <body>
    <h1>Sign in</h1>
    ${errorBlock}
    <form method="post" action="/login">
      <label for="username">Username</label>
      <input id="username" type="text" name="username" required REDACTEDcomplete="username" />
      <label for="password">Password</label>
      <input id="password" type="password" name="password" required REDACTEDcomplete="current-password" />
      <button type="submit">Sign in</button>
    </form>
    <p class="hint">Try username <code>demo</code> and password <code>pass</code>.</p>
  </body>
</html>`;
}

export const loginHandler = async (
  requestInfo: RequestInfo,
): Promise<Response> => {
  const { request } = requestInfo;

  if (request.method === 'GET') {
    return new Response(renderLoginPage(null), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'POST') {
    const form = await request.formData();
    const username = String(form.get('username') ?? '');
    const password = String(form.get('password') ?? '');

    const user = findUser(username, password);
    if (!user) {
      // Invalid credentials: re-render login with status 401, no session cookie.
      return new Response(
        renderLoginPage('Invalid username or password. Please try again.'),
        {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      );
    }

    const token = await createSessionToken(user.username);
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/dashboard',
        'Set-Cookie': buildSessionCookie(token),
      },
    });
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, POST' },
  });
};
