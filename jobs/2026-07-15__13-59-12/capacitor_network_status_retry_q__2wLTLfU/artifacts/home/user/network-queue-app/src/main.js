import { Network } from '@capacitor/network';

/* ------------------------------------------------------------------ */
/*  Offline-aware outbound request queue                               */
/* ------------------------------------------------------------------ */

const MAX_ATTEMPTS = 4; // at least 4 total attempts before giving up
const BASE_BACKOFF_MS = 100; // exponential backoff base delay

/**
 * Each queued item carries its own promise controls so that the
 * `submit()` caller can await delivery even when the request was
 * buffered while offline.
 *
 * @typedef {Object} QueueItem
 * @property {string} id
 * @property {string} body
 * @property {number} [failTimes]  - optional int passed through to the API
 * @property {(v: { status: string, id: string }) => void} resolve
 * @property {(e: Error) => void} reject
 * @property {boolean} done        - true once settled (resolved/rejected)
 */

/** @type {QueueItem[]} */
const queue = [];

/** Current connectivity, kept in sync with the Network plugin. */
let isConnected = false;

/* ------------------------------------------------------------------ */
/*  Low-level send with retry + exponential backoff                    */
/* ------------------------------------------------------------------ */

/**
 * Attempt to POST a single request to the API.
 *
 * Retries on HTTP 503 or network-level errors using an exponentially
 * increasing delay.  After MAX_ATTEMPTS total attempts the promise is
 * rejected.
 *
 * @param {{ id: string, body: string, failTimes?: number }} req
 * @returns {Promise<{ status: string, id: string }>}
 */
async function sendWithRetry(req) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const payload = {
        id: req.id,
        body: req.body,
      };
      if (typeof req.failTimes === 'number') {
        payload.failTimes = req.failTimes;
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 503) {
        // Transient failure — the server is telling us to retry.
        const body = await res.json().catch(() => ({}));
        lastError = new Error(`Server returned 503: ${JSON.stringify(body)}`);
      } else if (res.ok) {
        // Success
        const data = await res.json().catch(() => ({}));
        return data;
      } else {
        // Non-transient HTTP error — do not retry.
        const text = await res.text().catch(() => '');
        throw new Error(`Unexpected HTTP ${res.status}: ${text}`);
      }
    } catch (err) {
      // Network-level error (fetch threw) — transient, retry.
      lastError = err;
    }

    // If this was the last attempt, break out (caller will reject).
    if (attempt === MAX_ATTEMPTS) {
      break;
    }

    // Exponential backoff: base * 2^(attempt-1)
    const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
    await sleep(delay);
  }

  throw lastError || new Error('sendWithRetry exhausted attempts');
}

/* ------------------------------------------------------------------ */
/*  Queue helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Check whether an identical request (same id AND body) is already
 * waiting in the queue.
 */
function findDuplicate(id, body) {
  return queue.find(
    (item) => item.id === id && item.body === body && !item.done,
  );
}

/**
 * Flush the entire queue in strict FIFO order.
 *
 * Each item is sent sequentially so that delivery order matches
 * submission order.  Items are removed from the queue as soon as they
 * are handed off to `sendWithRetry` so that `pending()` stays accurate.
 */
let flushing = false;

async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    // Process items one at a time, in FIFO order.
    while (queue.length > 0) {
      const item = queue.shift();

      try {
        const result = await sendWithRetry({
          id: item.id,
          body: item.body,
          failTimes: item.failTimes,
        });
        item.done = true;
        item.resolve(result);
      } catch (err) {
        item.done = true;
        item.reject(err);
      }
    }
  } finally {
    flushing = false;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API exposed on window.offlineQueue                          */
/* ------------------------------------------------------------------ */

/**
 * Submit a request.
 *
 * If currently connected, attempt to send immediately (with retry).
 * If not connected, enqueue the request (applying de-duplication).
 *
 * @param {{ id: string, body: string, failTimes?: number }} req
 * @returns {Promise<{ status: string, id: string }>}
 */
function submit(req) {
  const { id, body } = req;
  const failTimes = typeof req.failTimes === 'number' ? req.failTimes : undefined;

  // Build the promise that the caller will await.
  let resolveRef, rejectRef;
  const promise = new Promise((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
  });

  if (isConnected) {
    // Send immediately (with retry/backoff on transient failures).
    sendWithRetry({ id, body, failTimes })
      .then(resolveRef)
      .catch(rejectRef);
  } else {
    // Offline — enqueue with de-duplication.
    const dup = findDuplicate(id, body);
    if (dup) {
      // Do not add a second copy; piggy-back on the existing promise.
      return dup.promise;
    }

    /** @type {QueueItem} */
    const item = {
      id,
      body,
      failTimes,
      resolve: resolveRef,
      reject: rejectRef,
      done: false,
      promise,
    };
    queue.push(item);
  }

  return promise;
}

/**
 * @returns {string[]} id strings currently waiting in the queue, in FIFO order.
 */
function pending() {
  return queue.filter((item) => !item.done).map((item) => item.id);
}

/**
 * @returns {boolean} current connectivity.
 */
function connected() {
  return isConnected;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateStatusDisplay() {
  const statusEl = document.getElementById('status');
  const pendingEl = document.getElementById('pending');
  if (statusEl) {
    statusEl.textContent = isConnected ? 'Connected' : 'Disconnected';
    statusEl.className = isConnected ? 'connected' : 'disconnected';
  }
  if (pendingEl) {
    pendingEl.textContent = `Pending: ${JSON.stringify(pending())}`;
  }
}

/* ------------------------------------------------------------------ */
/*  Initialisation                                                     */
/* ------------------------------------------------------------------ */

async function init() {
  // Get initial connectivity from the Network plugin (not navigator.onLine directly).
  const status = await Network.getStatus();
  isConnected = status.connected;

  // Listen for connectivity changes.
  await Network.addListener('networkStatusChange', (newStatus) => {
    const wasConnected = isConnected;
    isConnected = newStatus.connected;
    updateStatusDisplay();

    // Automatic flush on reconnect.
    if (!wasConnected && isConnected) {
      flushQueue();
    }
  });

  // Expose the control surface on window.
  window.offlineQueue = {
    submit,
    pending,
    connected,
  };

  updateStatusDisplay();
}

init().catch((err) => {
  console.error('Failed to initialise offline queue:', err);
});