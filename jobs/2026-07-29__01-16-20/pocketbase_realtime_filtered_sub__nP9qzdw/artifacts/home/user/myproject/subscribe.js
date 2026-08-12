#!/usr/bin/env node
"use strict";

// Node.js (unlike browsers) does not provide a global EventSource
// implementation, which the PocketBase SDK relies on for realtime
// subscriptions. Polyfill it before requiring the SDK.
if (typeof globalThis.EventSource === "undefined") {
  globalThis.EventSource = require("eventsource").EventSource;
}

const PocketBase = require("pocketbase/cjs");

const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";

function parseArgs(argv) {
  const args = { chat: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chat" || a === "-c") {
      args.chat = argv[i + 1];
      i++;
    } else if (a.startsWith("--chat=")) {
      args.chat = a.slice("--chat=".length);
    }
  }
  return args;
}

async function main() {
  const { chat } = parseArgs(process.argv.slice(2));

  if (!chat) {
    console.error("Usage: node subscribe.js --chat <chatId>");
    process.exit(1);
  }

  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "Missing PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD environment variables."
    );
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);
  // Realtime auto-cancellation is not needed for a single long-lived subscription.
  pb.autoCancellation(false);

  try {
    await pb.collection("_superusers").authWithPassword(email, password);
  } catch (err) {
    console.error("Authentication failed:", err && err.message ? err.message : err);
    process.exit(1);
  }

  let shuttingDown = false;

  const unsubscribe = await pb.collection("messages").subscribe(
    "*",
    (e) => {
      const line = JSON.stringify({ action: e.action, record: e.record });
      process.stdout.write(line + "\n");
    },
    { filter: `chat = "${chat}"` }
  );

  console.error(`Subscribed to messages for chat="${chat}". Waiting for events...`);

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`Received ${signal}, shutting down...`);

    const timeout = setTimeout(() => {
      console.error("Shutdown timed out, forcing exit.");
      process.exit(0);
    }, 2500);
    timeout.unref();

    try {
      await unsubscribe();
      pb.authStore.clear();
    } catch (err) {
      console.error("Error during shutdown:", err && err.message ? err.message : err);
    } finally {
      clearTimeout(timeout);
      process.exit(0);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal error:", err && err.message ? err.message : err);
  process.exit(1);
});
