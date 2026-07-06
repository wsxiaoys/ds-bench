#!/usr/bin/env node
"use strict";

// Polyfill EventSource (browser API) for Node.js before loading the PocketBase SDK
if (typeof globalThis.EventSource === "undefined") {
  globalThis.EventSource = require("eventsource").EventSource;
}

const PocketBase = require("pocketbase").default;

// ---- Argument parsing -------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--chat") {
      args.chat = argv[++i];
    } else if (arg.startsWith("--chat=")) {
      args.chat = arg.slice("--chat=".length);
    }
  }
  return args;
}

const parsed = parseArgs(process.argv);

if (!parsed.chat) {
  process.stderr.write("Usage: node subscribe.js --chat <chatId>\n");
  process.exit(1);
}

const chatId = parsed.chat;

// ---- Environment / config ---------------------------------------------------
const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  process.stderr.write(
    "Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD environment variables\n"
  );
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

// All logs go to stderr only
function log(msg) {
  process.stderr.write(`[subscribe] ${msg}\n`);
}

// ---- Main -------------------------------------------------------------------
let unsub = null;
let shuttingDown = false;

async function main() {
  // Authenticate as superuser
  await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
  log("Authenticated as superuser");

  // Subscribe to the messages collection with a server-side filter
  const filter = pb.filter("chat = {:chatId}", { chatId });

  unsub = await pb.collection("messages").subscribe(
    "*",
    (e) => {
      // e.action is "create" | "update" | "delete"
      // e.record contains the record data
      const line = JSON.stringify({
        action: e.action,
        record: e.record,
      });
      process.stdout.write(line + "\n");
    },
    { filter }
  );

  log(`Subscribed to messages where chat = "${chatId}"`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err && err.message ? err.message : String(err)}\n`);
  cleanupAndExit(1);
});

// ---- Graceful shutdown ------------------------------------------------------
function cleanupAndExit(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  // Force-exit after 3 seconds no matter what
  const forceTimer = setTimeout(() => {
    process.stderr.write("Forced exit after timeout\n");
    process.exit(code);
  }, 3000);
  forceTimer.unref();

 (async () => {
    try {
      if (unsub) {
        await unsub();
        log("Unsubscribed");
      }
    } catch (err) {
      process.stderr.write(
        `Error during cleanup: ${err && err.message ? err.message : String(err)}\n`
      );
    } finally {
      clearTimeout(forceTimer);
      process.exit(code);
    }
  })();
}

process.on("SIGTERM", () => {
  log("Received SIGTERM, shutting down...");
  cleanupAndExit(0);
});

process.on("SIGINT", () => {
  log("Received SIGINT, shutting down...");
  cleanupAndExit(0);
});