#!/usr/bin/env node

// Import EventSource polyfill for Node.js
global.EventSource = require('eventsource').EventSource;

const PocketBase = require('pocketbase').default;

// Parse command line arguments
let chatId = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--chat' && i + 1 < args.length) {
    chatId = args[i + 1];
    break;
  }
}

if (!chatId) {
  console.error("Error: --chat <chatId> is required");
  process.exit(1);
}

const pb = new PocketBase('http://127.0.0.1:8090');

// Disable REDACTED cancellation for server-side/CLI scripts
pb.REDACTEDCancellation(false);

let unsubscribeFn = null;

async function main() {
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables are required");
    process.exit(1);
  }

  try {
    // Authenticate as superuser
    await pb.collection('_superusers').authWithPassword(email, password);
    console.error("Authenticated successfully as superuser");
  } catch (err) {
    console.error("Authentication failed:", err.message);
    process.exit(1);
  }

  try {
    const filterExpr = pb.filter("chat = {:chatId}", { chatId: chatId });
    console.error(`Subscribing to messages collection with filter: ${filterExpr}`);

    unsubscribeFn = await pb.collection('messages').subscribe('*', (e) => {
      const output = JSON.stringify({
        action: e.action,
        record: e.record
      });
      process.stdout.write(output + '\n');
    }, {
      filter: filterExpr
    });

    console.error("Subscription active. Listening for events...");
  } catch (err) {
    console.error("Subscription failed:", err.message);
    process.exit(1);
  }
}

async function shutdown() {
  console.error("Shutting down gracefully...");
  try {
    if (unsubscribeFn) {
      await unsubscribeFn();
      console.error("Unsubscribed successfully");
    }
  } catch (err) {
    console.error("Error during unsubscribe:", err.message);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch(err => {
  console.error("Unhandled error in main:", err);
  process.exit(1);
});
