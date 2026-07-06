// pb_hooks/rate_limit.pb.js

onBootstrap((e) => {
    e.next();
    
    // Initialize the rate limit table and index
    $app.db().newQuery(`
        CREATE TABLE IF NOT EXISTS rate_limits (
            ip TEXT,
            timestamp INTEGER
        )
    `).execute();

    $app.db().newQuery(`
        CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_timestamp ON rate_limits (ip, timestamp)
    `).execute();
});

onRecordCreateRequest((e) => {
    try {
        console.log("e keys: " + Object.keys(e));
        if (e.requestEvent) {
            console.log("e.requestEvent keys: " + Object.keys(e.requestEvent));
            console.log("e.requestEvent.request: " + e.requestEvent.request);
            console.log("e.requestEvent.response: " + e.requestEvent.response);
            console.log("e.requestEvent.Request: " + e.requestEvent.Request);
            console.log("e.requestEvent.Response: " + e.requestEvent.Response);
        }

        // Get client real IP
        const ip = e.realIP();
        const now = Math.floor(Date.now() / 1000);

        let isRateLimited = false;
        let retryAfter = 0;

        $app.runInTransaction((txApp) => {
            // 1. Delete old entries (older than 60 seconds)
            txApp.db().newQuery("DELETE FROM rate_limits WHERE timestamp <= {:limit}")
                .bind({ limit: now - 60 })
                .execute();

            // 2. Count requests from this IP in the last 60 seconds
            const result = new DynamicModel({
                count: 0,
                min_timestamp: 0
            });
            txApp.db().newQuery("SELECT COUNT(*) as count, COALESCE(MIN(timestamp), 0) as min_timestamp FROM rate_limits WHERE ip = {:ip}")
                .bind({ ip: ip })
                .one(result);

            if (result.count >= 3) {
                isRateLimited = true;
                retryAfter = Math.max(1, (result.min_timestamp + 60) - now);
            } else {
                // 3. Insert new entry
                txApp.db().newQuery("INSERT INTO rate_limits (ip, timestamp) VALUES ({:ip}, {:timestamp})")
                    .bind({ ip: ip, timestamp: now })
                    .execute();
            }
            return null; // Return null for success
        });

        if (isRateLimited) {
            if (e.requestEvent && e.requestEvent.response) {
                e.requestEvent.response.header().set("Retry-After", retryAfter.toString());
            } else {
                console.log("Could not find response object!");
            }
            e.json(429, { retryAfter: retryAfter });
            return; // Stop the hook chain (do NOT call e.next())
        }

        e.next();
    } catch (err) {
        console.log("HOOK ERROR: " + err + "\n" + err.stack);
        throw err;
    }
}, "users");
