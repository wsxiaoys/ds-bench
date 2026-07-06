#!/usr/bin/env node

"use strict";

// ---------------------------------------------------------------------------
// EventSource polyfill
// ---------------------------------------------------------------------------
// The PocketBase JS SDK relies on the browser `EventSource` API for its
// realtime SSE connection.  Node.js only exposes `EventSource` behind the
// `--experimental-eventsource` flag (until it becomes stable), so we
// polyfill it from the `eventsource` npm package before loading the SDK.
if (typeof globalThis.EventSource === "undefined") {
    globalThis.EventSource = require("eventsource");
}

// The official `pocketbase` npm package ships as an ESM module. When
// required from CommonJS, the constructor is exposed under `.default`.
const PocketBase = require("pocketbase").default;

// ---------------------------------------------------------------------------
// CLI argument parsing:  node subscribe.js --chat <chatId>
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--chat") {
            args.chat = argv[++i];
        }
    }
    return args;
}

const parsed = parseArgs(process.argv);

if (!parsed.chat) {
    process.stderr.write('Usage: node subscribe.js --chat <chatId>\n');
    process.exit(1);
}

const chatId = parsed.chat;

// ---------------------------------------------------------------------------
// Environment / configuration
// ---------------------------------------------------------------------------
const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    process.stderr.write(
        "Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD environment variables\n"
    );
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a single JSON event line to stdout and flush immediately.
 * @param {{ action: string, record: object }} event
 */
function writeEvent(event) {
    const line = JSON.stringify(event) + "\n";
    // writeSync ensures the line is flushed to stdout right away
    process.stdout.write(line);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    // Create the PocketBase client. In Node.js the SDK falls back to an
    // in-memory auth store (LocalAuthStore), so the token is kept in memory
    // for the lifetime of the process.
    const pb = new PocketBase(PB_URL);

    // Disable REDACTED-cancellation so that concurrent realtime / API requests
    // don't accidentally cancel each other.
    pb.REDACTEDCancellation(false);

    // Authenticate as a superuser. The obtained token is stored in the
    // client's auth store and will be sent with every subsequent request,
    // including the realtime SSE subscription handshake.
    process.stderr.write(`[subscribe] Authenticating as ${PB_ADMIN_EMAIL}...\n`);
    await pb.collection("_superusers").authWithPassword(
        PB_ADMIN_EMAIL,
        PB_ADMIN_PASSWORD
    );
    process.stderr.write("[subscribe] Authenticated successfully.\n");

    // Open a realtime subscription on the `messages` collection.
    //
    // The topic "*" subscribes to all record changes in the collection.
    // The `filter` option is evaluated **server-side** by PocketBase so that
    // only events whose `chat` field equals the requested chat id are
    // delivered over the SSE connection – no client-side filtering needed.
    //
    // `pb.filter()` safely escapes the chat id value.
    process.stderr.write(
        `[subscribe] Subscribing to messages where chat = "${chatId}"...\n`
    );

    let unsubscribe = null;
    try {
        unsubscribe = await pb.collection("messages").subscribe(
            "*",
            (event) => {
                // event = { action: "create"|"update"|"delete", record: {...} }
                // Only forward the two fields we care about.
                writeEvent({
                    action: event.action,
                    record: event.record,
                });
            },
            {
                // Server-side filter – only events matching this expression
                // are pushed to this subscription.
                filter: pb.filter("chat = {:chat}", { chat: chatId }),
            }
        );
    } catch (err) {
        process.stderr.write(`[subscribe] Failed to subscribe: ${err?.message || err}\n`);
        process.exit(1);
    }

    process.stderr.write("[subscribe] Listening for realtime events...\n");

    // -------------------------------------------------------------------------
    // Graceful shutdown
    // -------------------------------------------------------------------------
    let shuttingDown = false;

    async function shutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;

        process.stderr.write(`[subscribe] Received ${signal}, shutting down...\n`);

        // Force-exit after 3 seconds no matter what, as required.
        const forceExit = setTimeout(() => {
            process.stderr.write("[subscribe] Forced exit after timeout.\n");
            process.exit(0);
        }, 3000);
        forceExit.unref();

        try {
            if (typeof unsubscribe === "function") {
                await unsubscribe();
            }
            // Close the underlying SSE connection / clean up resources.
            pb.realtime.disconnect();
        } catch (err) {
            // Ignore cleanup errors – we are exiting anyway.
            process.stderr.write(
                `[subscribe] Error during shutdown: ${err?.message || err}\n`
            );
        }

        clearTimeout(forceExit);
        process.stderr.write("[subscribe] Shutdown complete.\n");
        process.exit(0);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

// Run the main function and report any top-level errors to stderr.
main().catch((err) => {
    process.stderr.write(`[subscribe] Fatal error: ${err?.message || err}\n`);
    process.exit(1);
});