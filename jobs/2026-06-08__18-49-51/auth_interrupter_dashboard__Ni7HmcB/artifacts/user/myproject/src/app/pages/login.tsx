export function loginPageHtml(error?: string): string {
  const errorHtml = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 360px; }
    h1 { margin: 0 0 1.5rem; font-size: 1.5rem; }
    label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; margin-bottom: 1rem; }
    button { width: 100%; padding: 0.6rem; background: #0070f3; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #005ad1; }
    .error { color: #c0392b; background: #fdecea; border: 1px solid #f5c6cb; padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in</h1>
    ${errorHtml}
    <form method="post" action="/login">
      <label for="username">Username</label>
      <input id="username" type="text" name="username" autocomplete="username" required />
      <label for="password">Password</label>
      <input id="password" type="password" name="password" autocomplete="current-password" required />
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
