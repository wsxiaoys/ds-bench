#!/usr/bin/env node
/*
 * subscribe.js
 *
 * CLI that opens a server-side filtered PocketBase realtime (SSE)
 * subscription on the `messages` collection, restricted to the chat id
 * passed via the `--chat` flag. For every realtime event it writes
 * exactly one JSON object per line to stdout.
 *
 * Usage:
 *   node subscribe.js --chat <chatId>
 *
 * Required environment:
 *   PB_ADMIN_EMAIL    superuser email
 *   PB_ADMIN_PASSWORD superuser password
 */

"use strict";

const PocketBase = require("pocketbase");

// ---------------------------------------------------------------------------
// Argument parsing (minimal, supports --chat <id> only)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { chat: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chat") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        throw new Error("Missing value for --chat");
      }
      args.chat = v;
      i++;
    } else if (a.startsWith("--chat=")) {
      args.chat = a.slice("--chat=".length);
    }
  }
  if (!args.chat) {
    throw new Error("Missing required --chat <chatId> argument");
  }
  return args;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeFilterValue(value) {
  // Escape single quotes by doubling them, then wrap the whole value
  // in single quotes (matches PocketBase filter string literal rules).
  return "'" + String(value).replace(/'/g, "\\'") + "'";
}

function emitEvent(action, record) {
  // Build the output object. Use a plain JSON.stringify and write a single
  // newline-terminated line, flushing stdout right after.
  const payload = JSON.stringify({ action, record });
  if (!process.stdout.write(payload + "\n")) {
    // If the internal buffer is full, wait for drain before continuing
    // so we never silently drop events.
    return new Promise((resolve) => process.stdout.once("drain", resolve));
  }
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let chatId;
  try {
    const parsed = parseArgs(process.argv.slice(2));
    chatId = parsed.chat;
  } catch (err) {
    process.stderr.write(`subscribe.js: ${err.message}\n`);
    process.exit(2);
  }

  const adminEmail = process.env.PB_ADMIN_EMAIL;
  const adminPassword = process.env.PB_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    process.stderr.write(
      "subscribe.js: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set\n"
    );
    process.exit(2);
  }

  const pb = new PocketBase("http://127.0.0.1:8090");

  // Authenticate as superuser. Required so the subscription can access
  // the messages collection and use server-side filtering.
  try {
    await pb.admins.authWithPassword(adminEmail, adminPassword);
  } catch (err) {
    process.stderr.write(`subscribe.js: admin auth failed: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  }

  // Subscribe with a server-side filter so PocketBase only forwards events
  // for records whose `chat` field matches the requested chat id.
  let unsubscribe = null;
  try {
    unsubscribe = await pb.collection("messages").subscribe(
      "*",
      async (event) => {
        try {
          await emitEvent(event.action, event.record);
        } catch (writeErr) {
          process.stderr.write(
            `subscribe.js: failed to emit event: ${writeErr && writeErr.message ? writeErr.message : writeErr}\n`
          );
        }
      },
      {
        filter: `chat=${escapeFilterValue(chatId)}`,
      }
    );
  } catch (err) {
    process.stderr.write(
      `subscribe.js: subscribe failed: ${err && err.message ? err.message : err}\n`
    );
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // Graceful shutdown on SIGTERM (must complete within 3 seconds)
  // -----------------------------------------------------------------------
  let shuttingDown = false;
  const shutdown = (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;

    // Hard cap: if cleanup is still running after 2.8s, force-exit 0.
    const hardKill = setTimeout(() => {
      process.exit(0);
    }, 2800);
    if (typeof hardKill.unref === "function") hardKill.unref();

    Promise.resolve()
      .then(() => (typeof unsubscribe === "function" ? unsubscribe() : null))
      .then(() => {
        try {
          pb.realtime.disconnect();
        } catch (_) {
          /* ignore */
        }
      })
      .then(() => {
        try {
          pb.authStore.clear();
        } catch (_) {
          /* ignore */
        }
      })
      .catch((err) => {
        process.stderr.write(
          `subscribe.js: shutdown error: ${err && err.message ? err.message : err}\n`
        );
      })
      .finally(() => {
        clearTimeout(hardKill);
        process.exit(0);
      });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Keep the event loop alive. Without this the script would exit because
  // there is nothing else keeping Node.js running besides the SSE socket
  // (which is held open by the realtime service).
  process.stdin.resume();
}

main().catch((err) => {
  process.stderr.write(
    `subscribe.js: fatal: ${err && err.stack ? err.stack : err}\n`
  );
  process.exit(1);
});