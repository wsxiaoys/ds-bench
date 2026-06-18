export function dashboardPageHtml(username: string): string {
  const safeUsername = escapeHtml(username);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dashboard</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 480px; }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { color: #555; margin-bottom: 1.5rem; }
    form button { padding: 0.5rem 1rem; background: #e74c3c; color: white; border: none; border-radius: 4px; font-size: 0.875rem; cursor: pointer; }
    form button:hover { background: #c0392b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dashboard</h1>
    <p>Welcome, <strong>${safeUsername}</strong>! You are logged in.</p>
    <form method="post" action="/logout">
      <button type="submit">Logout</button>
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
