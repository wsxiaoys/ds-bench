// Entry point: wires up @capacitor/network and exposes window.offlineQueue.
//
// Connectivity is sourced exclusively from @capacitor/network:
//   - Network.getStatus() seeds the initial connected/!connected state.
//   - Network.addListener('networkStatusChange', ...) drives updates.
//
// The web implementation derives connectivity from window 'online'/'offline'
// events, which fire when the browser toggles offline emulation.

import { offlineQueue, init } from './queue.js';

async function bootstrap() {
  // Make the public surface available as early as possible, even before
  // init() resolves, so callers that race the bootstrap can still find it.
  window.offlineQueue = offlineQueue;

  try {
    await init();
  } catch (err) {
    // If the plugin somehow fails to initialize, fall back to the default
    // optimistic connected=true and re-expose the queue.
    console.error('Failed to initialize network plugin:', err);
    window.offlineQueue = offlineQueue;
  }
}

bootstrap();
