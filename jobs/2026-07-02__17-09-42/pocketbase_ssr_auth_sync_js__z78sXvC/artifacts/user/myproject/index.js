const express = require("express");
const cookieParser = require("cookie-parser");
const PocketBase = require("pocketbase").default;

const app = express();
const PORT = 3000;
const PB_URL = "http://127.0.0.1:8090";

// Middleware: parse cookies from the request headers so that
// `req.cookies.pb_auth` is populated for the auth sync middleware below.
app.use(cookieParser());

/**
 * Authentication Synchronization Middleware
 *
 * - Extracts the `pb_auth` cookie from the incoming request.
 * - Loads it into a PocketBase SDK instance connected to PocketBase.
 * - Attempts to refresh the authentication state via `authRefresh()`.
 * - Exports the (possibly updated) auth state back as a `Set-Cookie` header.
 *
 * If the cookie is missing/invalid/expired, the auth store is cleared and
 * the cleared state is exported to clear the cookie on the client.
 */
app.use(async (req, res, next) => {
  // Create a fresh PocketBase instance per request so auth state is isolated.
  const pb = new PocketBase(PB_URL);

  // Reconstruct the full cookie header that `loadFromCookie` expects.
  // `loadFromCookie` parses the string looking for the `pb_auth` key, so
  // passing just `pb_auth=<value>` is sufficient.
  const pbAuthCookie = req.cookies && req.cookies.pb_auth;
  const cookieHeader = pbAuthCookie ? `pb_auth=${pbAuthCookie}` : "";

  // Load the cookie into the auth store. This is a local-only operation
  // and does not contact the network.
  pb.authStore.loadFromCookie(cookieHeader);

  // Try to refresh the auth state. Only attempt refresh if we have a token
  // that appears valid locally; otherwise call authRefresh would fail anyway.
  try {
    if (pb.authStore.isValid) {
      await pb.collection("users").authRefresh();
    } else if (pb.authStore.token) {
      // We have a token but it's already expired/invalid - clear it.
      pb.authStore.clear();
    }
  } catch (_err) {
    // Refresh failed (token expired, invalid, or revoked). Clear the store
    // so subsequent handlers know the user is unauthenticated, and so that
    // the exported cookie clears the stale token on the client.
    pb.authStore.clear();
  }

  // Always export the current auth state as a `Set-Cookie` header so the
  // client receives either a refreshed `pb_auth` cookie (when authenticated)
  // or a cleared one (when unauthenticated).
  res.setHeader("Set-Cookie", pb.authStore.exportToCookie());

  // Attach the PocketBase instance to the request for downstream handlers.
  req.pb = pb;

  next();
});

/**
 * GET /profile
 *
 * Protected route that returns the authenticated user's profile when the
 * `pb_auth` cookie is valid. The middleware above already refreshed the
 * auth state, so we simply check `pb.authStore.record` (populated on a
 * successful refresh) and `pb.authStore.isValid` to decide whether the
 * caller is authenticated.
 */
app.get("/profile", (req, res) => {
  const pb = req.pb;

  if (pb.authStore.isValid && pb.authStore.record) {
    const { id, email } = pb.authStore.record;
    return res.status(200).json({ id, email });
  }

  return res.status(401).json({ error: "Unauthorized" });
});

app.listen(PORT, () => {
  console.log(`SSR auth server listening on http://127.0.0.1:${PORT}`);
});