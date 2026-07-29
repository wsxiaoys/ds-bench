const express = require("express");
const cookieParser = require("cookie-parser");
const PocketBase = require("pocketbase/cjs");

const PB_URL = "http://127.0.0.1:8090";
const AUTH_COOKIE_NAME = "pb_auth";

const app = express();
app.use(cookieParser());

/**
 * Middleware that synchronizes PocketBase authentication state via cookies.
 *
 * - Loads the `pb_auth` cookie (if any) from the incoming request into a
 *   per-request PocketBase SDK instance.
 * - Attempts to refresh the auth state against the PocketBase API.
 * - Clears the auth store if the refresh fails (expired/invalid token).
 * - Always exports the (possibly updated) auth state back to a `Set-Cookie`
 *   header on the response, so the client stays in sync with the server.
 */
async function pbAuthMiddleware(req, res, next) {
  const pb = new PocketBase(PB_URL);

  // Load the auth state from the raw Cookie header sent by the client.
  pb.authStore.loadFromCookie(req.headers.cookie || "");

  try {
    if (pb.authStore.isValid) {
      // Validate + refresh the token against PocketBase.
      await pb.collection("users").authRefresh();
    }
  } catch (err) {
    // Token expired/invalid (or PocketBase unreachable) - clear auth state.
    pb.authStore.clear();
  }

  // Attach the pb instance to the request for use in route handlers.
  req.pb = pb;

  // Export the (refreshed or cleared) auth state back to the client.
  res.setHeader(
    "Set-Cookie",
    pb.authStore.exportToCookie({ httpOnly: true }, AUTH_COOKIE_NAME),
  );

  next();
}

app.use(pbAuthMiddleware);

app.get("/profile", (req, res) => {
  const pb = req.pb;

  if (!pb.authStore.isValid || !pb.authStore.record) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id, email } = pb.authStore.record;
  return res.status(200).json({ id, email });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
