global.EventSource = require('eventsource').EventSource;
const PocketBase = require('pocketbase/cjs');

// Parse arguments
const args = process.argv.slice(2);
let chatId = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--chat' && i + 1 < args.length) {
    chatId = args[i + 1];
    break;
  }
}

if (!chatId) {
  console.error("Error: --chat <chatId> is required.");
  process.exit(1);
}

const email = process.env.PB_ADMIN_EMAIL;
const password = process.env.PB_ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables are required.");
  process.exit(1);
}

const pb = new PocketBase('http://127.0.0.1:8090');

// Handle graceful shutdown
let isShuttingDown = false;
const cleanup = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    // Unsubscribe from all topics on messages collection to close subscription and SSE connection
    await pb.collection('messages').unsubscribe();
    pb.authStore.clear();
  } catch (err) {
    console.error("Error during cleanup:", err.message || err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => {
  // We must exit with status 0 within 3 seconds
  const timer = setTimeout(() => {
    process.exit(0);
  }, 2500);

  cleanup().then(() => {
    clearTimeout(timer);
  });
});

process.on('SIGINT', () => {
  cleanup();
});

async function main() {
  try {
    // Authenticate as superuser
    await pb.collection('_superusers').authWithPassword(email, password);
  } catch (err) {
    console.error("Authentication failed:", err.message || err);
    process.exit(1);
  }

  try {
    // PocketBase v0.31.0 supports server-side filtering on realtime subscriptions
    // by passing options with 'filter' property.
    // Let's use pb.filter to build a safe filter string.
    const filterString = pb.filter("chat = {:chatId}", { chatId });

    await pb.collection('messages').subscribe('*', (e) => {
      const output = {
        action: e.action,
        record: e.record
      };
      // Write exactly one JSON object on its own line to stdout and flush immediately
      process.stdout.write(JSON.stringify(output) + '\n');
    }, {
      filter: filterString
    });

  } catch (err) {
    console.error("Subscription failed:", err.message || err);
    process.exit(1);
  }
}

main();
