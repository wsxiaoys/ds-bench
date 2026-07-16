import { Network } from '@capacitor/network';

// In-memory queue storage
const queue = [];
let isConnected = true;
let isProcessing = false;

// Sleep utility for backoff delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Send item with exponential backoff on transient errors (503 or network errors)
async function sendWithRetry(item) {
  let attempt = 0;
  const maxAttempts = 4;
  const baseDelay = 100; // ms

  while (attempt < maxAttempts) {
    attempt++;

    // Check connection state before attempting
    if (!isConnected) {
      throw new Error('Offline');
    }

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: item.id,
          body: item.body,
          failTimes: item.failTimes
        })
      });

      if (response.status === 200) {
        return; // Success!
      } else if (response.status === 503) {
        // Transient 503 error, retry if we have attempts left
        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await sleep(delay);
          continue;
        } else {
          throw new Error('Failed after max attempts (503)');
        }
      } else {
        // Other non-transient error, fail immediately
        throw new Error(`Server responded with status ${response.status}`);
      }
    } catch (err) {
      if (err.message === 'Offline') {
        throw err;
      }
      
      // Network error/exception is also a transient error, retry if we have attempts left
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      } else {
        throw err;
      }
    }
  }
}

// Process the queue in strict FIFO (submission) order
async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      // Find the first item that is not yet completed (not success, and not failed)
      const item = queue.find(it => it.status !== 'success' && it.status !== 'failed');
      if (!item) {
        break;
      }

      // Check connection status before proceeding
      if (!isConnected) {
        break;
      }

      item.status = 'sending';
      updateUI();

      try {
        await sendWithRetry(item);
        item.status = 'success';
        updateUI();
        item.resolve({ status: 'ok', id: item.id });
      } catch (err) {
        if (err.message === 'Offline') {
          // Revert status to pending and pause queue processing
          item.status = 'pending';
          updateUI();
          break;
        }
        item.status = 'failed';
        updateUI();
        item.reject(err);
      }
    }
  } finally {
    isProcessing = false;
    updateUI();
  }
}

// Initialize @capacitor/network status and listener
async function initNetwork() {
  try {
    const status = await Network.getStatus();
    isConnected = status.connected;
    updateUI();
  } catch (e) {
    console.error('Failed to get network status', e);
  }

  Network.addListener('networkStatusChange', (status) => {
    console.log('Network status changed:', status);
    const wasConnected = isConnected;
    isConnected = status.connected;
    updateUI();

    if (isConnected && !wasConnected) {
      // Reconnected! Flush the queue.
      processQueue();
    }
  });
}

// Expose control surface on window
window.offlineQueue = {
  submit({ id, body, failTimes }) {
    // Check for duplicate already waiting in the queue
    const duplicate = queue.find(
      item => item.status !== 'success' && item.status !== 'failed' && item.id === id && item.body === body
    );
    if (duplicate) {
      return duplicate.promise;
    }

    let resolveFn, rejectFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    const newItem = {
      id,
      body,
      failTimes: failTimes !== undefined ? Number(failTimes) : 0,
      status: 'pending',
      resolve: resolveFn,
      reject: rejectFn,
      promise
    };

    queue.push(newItem);
    updateUI();

    // Trigger processing
    processQueue();

    return promise;
  },

  pending() {
    return queue
      .filter(item => item.status !== 'success' && item.status !== 'failed')
      .map(item => item.id);
  },

  connected() {
    return isConnected;
  }
};

// UI Update and Event Listeners
function updateUI() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const pendingList = document.getElementById('pending-list');

  if (!statusDot || !statusText || !pendingList) return;

  if (isConnected) {
    statusDot.className = 'status-indicator status-online';
    statusText.textContent = 'Connected';
  } else {
    statusDot.className = 'status-indicator status-offline';
    statusText.textContent = 'Offline';
  }

  const pendingItems = queue.filter(item => item.status !== 'success' && item.status !== 'failed');
  if (pendingItems.length === 0) {
    pendingList.innerHTML = '<li>No pending messages</li>';
  } else {
    pendingList.innerHTML = pendingItems.map(item => `
      <li>
        <span><strong>ID:</strong> ${item.id} (status: ${item.status})</span>
        <span>${item.body}</span>
      </li>
    `).join('');
  }
}

async function fetchReceived() {
  try {
    const res = await fetch('/api/received');
    const data = await res.json();
    const receivedList = document.getElementById('received-list');
    if (!receivedList) return;

    if (data.messages.length === 0) {
      receivedList.innerHTML = '<li>No received messages</li>';
    } else {
      receivedList.innerHTML = data.messages.map(msg => `
        <li class="received-item">
          <span><strong>ID:</strong> ${msg.id}</span>
          <span>${msg.body}</span>
        </li>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to fetch received messages', err);
  }
}

// Initialize network status and listeners immediately
initNetwork();

// Wire up UI events
document.addEventListener('DOMContentLoaded', () => {
  updateUI();

  const submitBtn = document.getElementById('submit-btn');
  const msgIdInput = document.getElementById('msg-id');
  const msgBodyInput = document.getElementById('msg-body');
  const msgFailTimesInput = document.getElementById('msg-fail-times');
  const refreshBtn = document.getElementById('refresh-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const id = msgIdInput.value.trim();
      const body = msgBodyInput.value.trim();
      const failTimes = msgFailTimesInput.value ? parseInt(msgFailTimesInput.value, 10) : 0;

      if (!id || !body) {
        alert('Please fill in both ID and Body.');
        return;
      }

      window.offlineQueue.submit({ id, body, failTimes })
        .then(() => {
          fetchReceived();
        })
        .catch(err => {
          console.error(`Submission failed for ${id}:`, err);
        });

      // Clear fields
      msgIdInput.value = '';
      msgBodyInput.value = '';
      msgFailTimesInput.value = '';
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchReceived);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      await fetch('/api/reset', { method: 'POST' });
      fetchReceived();
    });
  }

  // Initial fetch of received log
  fetchReceived();
});
