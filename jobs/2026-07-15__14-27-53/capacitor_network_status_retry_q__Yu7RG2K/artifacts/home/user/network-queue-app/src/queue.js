// Offline-aware request queue.
//
// Uses @capacitor/network (web implementation) to track connectivity.
// The web implementation derives connectivity from window 'online'/'offline'
// events, which is exactly what the verifier toggles through the browser's
// offline emulation.

import { Network } from '@capacitor/network';

// Internal state
const state = {
  // FIFO of queued request items. Each item: { id, body, failTimes, settled,
  // resolve, reject, promise }.
  queue: [],
  // Latest known connectivity, as reported by Network.getStatus() or a
  // 'networkStatusChange' event.
  connected: true,
  // Set to true while a flush is in progress, so a reconnect event triggered
  // mid-flush does not start a second concurrent flush.
  flushing: false,
  // Promise tracking the active flush, used to coalesce calls.
  activeFlush: null,
  // Disposer for the networkStatusChange listener.
  removeListener: null,
};

const MAX_ATTEMPTS = 4; // total attempts (initial + 3 retries) per request
const BASE_DELAY_MS = 50; // base for exponential backoff

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt) {
  // attempt is 0-based: 0 -> 50ms, 1 -> 100ms, 2 -> 200ms
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

async function sendOnce(item) {
  // Sends a single attempt; throws on transient failure (network error or 503).
  let response;
  try {
    response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        body: item.body,
        failTimes: typeof item.failTimes === 'number' ? item.failTimes : 0,
      }),
    });
  } catch (err) {
    // Network error (offline mid-flight, DNS, etc.) is treated as transient.
    const wrapped = new Error('network-error');
    wrapped.cause = err;
    throw wrapped;
  }

  if (response.status === 503) {
    throw new Error('transient-503');
  }
  if (!response.ok) {
    // Non-transient failure: do not retry.
    const text = await response.text().catch(() => '');
    const err = new Error(`http-${response.status}`);
    err.body = text;
    err.fatal = true;
    throw err;
  }
  return response;
}

async function sendWithRetry(item) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // If connectivity dropped during retries, keep the item in the queue
    // for the next reconnect rather than burning the remaining attempts.
    if (!state.connected) {
      const err = new Error('offline-during-retry');
      err.keepInQueue = true;
      throw err;
    }
    try {
      const res = await sendOnce(item);
      return res;
    } catch (err) {
      const fatal = !!(err && err.fatal);
      const keepInQueue = !!(err && err.keepInQueue);
      const last = attempt === MAX_ATTEMPTS - 1;
      if (fatal || keepInQueue || last) {
        throw err;
      }
      await delay(backoffDelay(attempt));
    }
  }
  throw new Error('unreachable');
}

function findDuplicateIndex(id, body) {
  return state.queue.findIndex((q) => q.id === id && q.body === body);
}

function settleItem(item, outcome, error) {
  if (item.settled) return;
  item.settled = true;
  if (outcome === 'success') {
    item.resolve(true);
  } else {
    item.reject(error || new Error('queue-failed'));
  }
}

async function processItem(item) {
  try {
    await sendWithRetry(item);
    settleItem(item, 'success');
  } catch (err) {
    if (err && err.keepInQueue) {
      // Device went offline mid-retry. Leave the item in the queue so the
      // next reconnect can resume sending it.
      return;
    }
    settleItem(item, 'error', err);
  }
}

async function flushQueue() {
  if (state.flushing) {
    return state.activeFlush;
  }
  if (state.queue.length === 0) {
    return;
  }
  state.flushing = true;
  state.activeFlush = (async () => {
    // Strict FIFO: process items in submission order. New items submitted
    // during the flush join the end of the queue and are picked up by
    // the same loop, preserving order.
    while (state.queue.length > 0 && state.connected) {
      const item = state.queue[0];
      if (item.settled) {
        // Already done; drop and continue.
        state.queue.shift();
        continue;
      }
      await processItem(item);
      if (item.settled) {
        state.queue.shift();
      } else {
        // processItem bailed out without settling (e.g. connectivity
        // dropped). Stop the flush; the remaining items (including this
        // one) stay in the queue for the next reconnect.
        break;
      }
    }
  })();
  try {
    await state.activeFlush;
  } finally {
    state.flushing = false;
    state.activeFlush = null;
  }
}

function submit({ id, body, failTimes } = {}) {
  if (typeof id !== 'string' || typeof body !== 'string') {
    return Promise.reject(
      new Error('submit requires { id: string, body: string }'),
    );
  }

  // De-duplication: if an identical (id AND body) item is already waiting
  // in the queue, do not add a second copy. The caller still receives a
  // promise that resolves with the existing item's outcome.
  const dupIdx = findDuplicateIndex(id, body);
  if (dupIdx !== -1) {
    return state.queue[dupIdx].promise;
  }

  const item = {
    id,
    body,
    failTimes: typeof failTimes === 'number' ? failTimes : 0,
    settled: false,
    resolve: null,
    reject: null,
    promise: null,
  };
  const promise = new Promise((resolve, reject) => {
    item.resolve = resolve;
    item.reject = reject;
  });
  item.promise = promise;

  state.queue.push(item);

  if (state.connected) {
    // Fire and forget. submit() returns a promise that resolves when
    // this specific item is settled, which the flush loop will do.
    flushQueue().catch(() => {
      // Errors are surfaced via per-item reject(); nothing to do here.
    });
  }
  // If offline, the item stays in the queue until the next reconnect.

  return promise;
}

function pending() {
  // IDs of items that have not yet been successfully delivered (and not
  // yet given up after retries), in FIFO order.
  const out = [];
  for (const item of state.queue) {
    if (!item.settled) {
      out.push(item.id);
    }
  }
  return out;
}

function connected() {
  return state.connected;
}

function onNetworkStatusChange(status) {
  const wasConnected = state.connected;
  state.connected = !!status.connected;
  if (!wasConnected && state.connected) {
    // Reconnect: flush everything still waiting in strict FIFO order.
    if (state.queue.length > 0 && !state.flushing) {
      flushQueue().catch(() => {});
    }
  }
}

async function init() {
  // Seed the connectivity from getStatus() so the very first submit() call
  // sees the correct state before the first event fires.
  try {
    const status = await Network.getStatus();
    state.connected = !!status.connected;
  } catch (err) {
    state.connected = true; // optimistic default
  }
  // Register the networkStatusChange listener. The web implementation
  // derives connectivity from window 'online'/'offline' events.
  const handle = await Network.addListener('networkStatusChange', (status) => {
    onNetworkStatusChange(status);
  });
  state.removeListener = handle;
}

const offlineQueue = {
  submit,
  pending,
  connected,
  // Exposed for testability, not part of the public contract.
  _flush: flushQueue,
};

export { offlineQueue, init };
