// pb_hooks/signup_rate_limit.pb.js
//
// Per-IP rate limiter for the user-signup endpoint
//     POST /api/collections/users/records
//
// Policy: at most 3 successful requests (regardless of whether the
// underlying signup succeeded or was rejected for validation) per
// client IP inside any rolling 60-second window. The 4th request in
// the window is rejected with HTTP 429 and a Retry-After hint.
//
// Other endpoints (e.g. GET /api/collections/users/records) are not
// affected, because this hook is only registered for the
// OnRecordCreateRequest event on the "users" collection.

const RATE_LIMIT   = 3;            // max requests per window
const WINDOW_MS    = 60 * 1000;    // rolling window length
const MIN_RETRY    = 1;            // Retry-After floor (seconds)

// In-memory bucket store: client IP -> array of request timestamps (ms, ascending).
// PocketBase loads every *.pb.js file once at startup, so this state is shared
// by every request served by the same process.
const ipBuckets = new Map();

/**
 * checkAndUpdate
 * ---------------
 * Records the current request against the given IP's bucket and reports
 * whether the request is allowed.
 *
 * @param {string} ip  The client IP address to rate-limit on.
 * @returns {{ limited: boolean, retryAfter?: number }}
 *   - limited=false when the request is allowed (and has been recorded).
 *   - limited=true  when the bucket is full. retryAfter is the integer
 *     number of seconds the caller should wait before the next attempt
 *     (>= MIN_RETRY).
 */
function checkAndUpdate(ip) {
    const now    = Date.now();
    const cutoff = now - WINDOW_MS;

    let bucket = ipBuckets.get(ip);
    if (!bucket) {
        bucket = [];
        ipBuckets.set(ip, bucket);
    }

    // Drop timestamps that have fallen out of the rolling window. They are
    // stored in insertion order, so we can trim from the head efficiently.
    while (bucket.length > 0 && bucket[0] <= cutoff) {
        bucket.shift();
    }

    if (bucket.length >= RATE_LIMIT) {
        // Bucket is full. The earliest free slot opens when the oldest
        // timestamp leaves the window.
        const oldest       = bucket[0];
        const waitMs       = (oldest + WINDOW_MS) - now;
        const retryAfter   = Math.max(MIN_RETRY, Math.ceil(waitMs / 1000));
        return { limited: true, retryAfter: retryAfter };
    }

    // Allowed: stamp this request into the bucket.
    bucket.push(now);

    // Cheap memory hygiene: when the map gets large, drop any bucket whose
    // newest entry is already outside the window. This keeps the footprint
    // bounded under steady load without affecting the rate-limit decisions.
    if (ipBuckets.size > 10000) {
        for (const [key, value] of ipBuckets) {
            if (value.length === 0 || value[value.length - 1] <= cutoff) {
                ipBuckets.delete(key);
            }
        }
    }

    return { limited: false };
}

onRecordCreateRequest((e) => {
    // Filter is also expressed as a tag below ("users"), so this hook
    // only runs for POST /api/collections/users/records. We still
    // double-check defensively.
    if (!e.collection || e.collection.name !== "users") {
        return;
    }

    // e.realIP() honours Settings.TrustedProxy + X-Forwarded-For when
    // configured, and otherwise falls back to the connection's remote
    // address. Either way it gives us a single, stable client IP.
    const ip = e.realIP() || "unknown";

    const result = checkAndUpdate(ip);
    if (result.limited) {
        // Set the Retry-After header BEFORE writing the body so the
        // header is included in the final response.
        e.response.header().set("Retry-After", String(result.retryAfter));
        e.json(429, {
            retryAfter: result.retryAfter,
            message:    "Too many signup attempts from this IP. Please slow down.",
        });
        // Returning without calling e.next() short-circuits the request,
        // so the actual record-create handler is not executed.
        return;
    }
    // Otherwise, the request is allowed to proceed normally.
}, "users");
