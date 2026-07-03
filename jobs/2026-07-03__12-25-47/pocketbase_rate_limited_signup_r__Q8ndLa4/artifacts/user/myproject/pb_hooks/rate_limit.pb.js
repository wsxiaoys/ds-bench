console.log("HOOK LOADED");

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 3;

if (typeof globalThis.__signupRateLimitStore === "undefined") {
    globalThis.__signupRateLimitStore = {};
}
const rateLimitStore = globalThis.__signupRateLimitStore;
console.log("HOOK store:", JSON.stringify(rateLimitStore));

onRecordCreateRequest((e) => {
    console.log("HOOK CALLED");
    try {
        if (!e.collection || e.collection.name !== "users") {
            console.log("HOOK skip non-users");
            return;
        }
        console.log("HOOK users collection");

        const ip = e.realIP();
        const now = Date.now();
        console.log("HOOK ip:", ip);

        if (!rateLimitStore[ip]) {
            rateLimitStore[ip] = [];
        }
        const timestamps = rateLimitStore[ip];
        console.log("HOOK step 1", timestamps.length);

        const cutoff = now - RATE_LIMIT_WINDOW_MS;
        while (timestamps.length > 0 && timestamps[0] <= cutoff) {
            timestamps.shift();
        }
        console.log("HOOK step 2", timestamps.length);

        if (timestamps.length >= RATE_LIMIT_MAX) {
            const oldest = timestamps[0];
            const retryAfterMs = (oldest + RATE_LIMIT_WINDOW_MS) - now;
            let retryAfterSec = Math.ceil(retryAfterMs / 1000);
            if (retryAfterSec < 1) {
                retryAfterSec = 1;
            }
            console.log("HOOK rate limited:", retryAfterSec);
            try {
                e.response.header().set("Retry-After", String(retryAfterSec));
            } catch (hErr) {
                console.log("HOOK header err:", hErr);
            }
            try {
                e.json(429, {
                    status: 429,
                    message: "Too many signup attempts",
                    retryAfter: retryAfterSec,
                });
            } catch (jErr) {
                console.log("HOOK json err:", jErr);
            }
            throw new ApiError(429, "stop", {});
        }

        timestamps.push(now);
        console.log("HOOK step 3 pushed");
    } catch (err) {
        console.log("HOOK ERROR: " + err + " stack: " + (err && err.stack ? err.stack : "none"));
        throw err;
    }
}, "users");
