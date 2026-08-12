/// <reference path="../pb_data/types.d.ts" />

// Per-IP rate limiting for the user signup endpoint.
//
// Enforces a limit of 3 requests per rolling 60 second window per client IP
// for POST /api/collections/users/records (the built-in "users" auth
// collection create/signup route). Requests over the limit receive a 429
// response with a `Retry-After` header (seconds) and a JSON body containing
// a top-level `retryAfter` field with the same value.
//
// The rate limit state is kept in $app.store(), a concurrency-safe
// in-memory key/value store backed by the Go runtime and shared across all
// JS VM instances in the pool, so counters stay consistent regardless of
// which VM handles a given request.
//
// NOTE: everything the handler needs is declared *inside* the handler
// function itself (no top-level const/let references) since PocketBase's
// JSVM may invoke registered route handlers without access to the
// enclosing file's top-level module scope.
routerUse((e) => {
  const RL_METHOD = "POST";
  const RL_PATH = "/api/collections/users/records";
  const RL_MAX_REQUESTS = 3;
  const RL_WINDOW_MS = 60000;
  const RL_STORE_PREFIX = "signup_rl:";

  if (e.request.method !== RL_METHOD || e.request.url.path !== RL_PATH) {
    return e.next();
  }

  const ip = e.realIP();
  const key = RL_STORE_PREFIX + ip;
  const now = Date.now();

  let allowed = true;
  let retryAfter = 1;

  $app.store().setFunc(key, (old) => {
    let timestamps = [];

    if (old) {
      try {
        timestamps = JSON.parse(old);
      } catch (err) {
        timestamps = [];
      }
    }

    // keep only the timestamps that are still within the rolling window
    timestamps = timestamps.filter((t) => now - t < RL_WINDOW_MS);

    if (timestamps.length >= RL_MAX_REQUESTS) {
      allowed = false;

      const oldest = timestamps[0];
      retryAfter = Math.ceil((RL_WINDOW_MS - (now - oldest)) / 1000);
      if (retryAfter < 1) {
        retryAfter = 1;
      }

      // don't record the rejected request, just persist the trimmed window
      return JSON.stringify(timestamps);
    }

    timestamps.push(now);

    return JSON.stringify(timestamps);
  });

  if (!allowed) {
    e.response.header().set("Retry-After", String(retryAfter));

    return e.json(429, {
      status: 429,
      message: "Too many signup requests. Please try again later.",
      retryAfter: retryAfter,
    });
  }

  return e.next();
});
