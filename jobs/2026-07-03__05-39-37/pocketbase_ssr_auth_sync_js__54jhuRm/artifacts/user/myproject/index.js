const express = require('express');
const cookieParser = require('cookie-parser');
const PocketBase = require('pocketbase/cjs');

const app = express();
const PORT = 3000;
const PB_URL = 'http://127.0.0.1:8090';

// Parse cookies so they are available on req.cookies (also used as a fallback).
app.use(cookieParser());

/**
 * SSR Authentication Synchronization Middleware
 *
 * PocketBase is stateless and (by default) stores the JWT in the browser's
 * localStorage. In an SSR setup the server needs to know the auth state too,
 * so we synchronize it through a cookie (`pb_auth`).
 *
 * On every request we:
 *   1. Load the `pb_auth` cookie into a fresh PocketBase instance.
 *   2. Try to refresh the token via the PocketBase API (`authRefresh()`).
 *   3. Export the (possibly refreshed / cleared) auth state back into a
 *      `Set-Cookie` response header so the client stays in sync.
 */
async function pbAuthSyncMiddleware(req, res, next) {
  // Create a new PocketBase client for this request so auth states never leak
  // between concurrent requests.
  const pb = new PocketBase(PB_URL);

  // Disable REDACTED-cancellation so a follow-up request doesn't abort the
  // in-flight authRefresh() of a previous one.
  pb.REDACTEDCancellation(false);

  // 1. Load the auth state from the incoming cookie header.
  pb.authStore.loadFromCookie(req.headers.cookie || '');

  // 2. Attempt to refresh the authentication state using the PocketBase API.
  try {
    if (pb.authStore.token) {
      // Validate + refresh the token server-side. If the token is expired or
      // invalid this throws and we clear the auth store below.
      await pb.collection('users').authRefresh();
    }
  } catch (err) {
    // Token is missing, expired or invalid -> reflect the unauthenticated state.
    pb.authStore.clear();
  }

  // 3. Export the updated auth state to a cookie and attach it to the response.
  const cookieStr = pb.authStore.exportToCookie(
    {
      secure: false, // allow over plain HTTP on localhost
      sameSite: 'Lax',
      httpOnly: true,
      path: '/',
    },
    'pb_auth'
  );
  res.setHeader('Set-Cookie', cookieStr);

  // Expose the PocketBase instance to downstream handlers.
  req.pb = pb;

  next();
}

app.use(pbAuthSyncMiddleware);

/**
 * Protected route.
 *
 * - Valid `pb_auth` cookie  -> 200 with { id, email } + refreshed Set-Cookie.
 * - Invalid / missing cookie -> 401 with { error: "Unauthorized" } +
 *   a Set-Cookie that clears / reflects the unauthenticated state.
 */
app.get('/profile', (req, res) => {
  const pb = req.pb;

  if (pb.authStore.isValid && pb.authStore.record) {
    const record = pb.authStore.record;
    return res.status(200).json({
      id: record.id,
      email: record.email,
    });
  }

  return res.status(401).json({ error: 'Unauthorized' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;