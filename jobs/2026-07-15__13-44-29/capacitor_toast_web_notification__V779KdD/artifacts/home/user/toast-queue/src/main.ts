import { enqueueToast, drainToastQueue, getQueueState } from './toastQueue';

// Attach to window for external/automated access
(window as any).enqueueToast = enqueueToast;
(window as any).drainToastQueue = drainToastQueue;
(window as any).getQueueState = getQueueState;

// UI elements
const toastTextInput = document.getElementById('toast-text') as HTMLInputElement;
const toastDurationSelect = document.getElementById('toast-duration') as HTMLSelectElement;
const toastPositionSelect = document.getElementById('toast-position') as HTMLSelectElement;

const btnEnqueue = document.getElementById('btn-enqueue') as HTMLButtonElement;
const btnEnqueueBurst = document.getElementById('btn-enqueue-burst') as HTMLButtonElement;
const btnDrain = document.getElementById('btn-drain') as HTMLButtonElement;

const statePending = document.getElementById('state-pending') as HTMLSpanElement;
const stateActive = document.getElementById('state-active') as HTMLSpanElement;
const drainStatus = document.getElementById('drain-status') as HTMLDivElement;
const logConsole = document.getElementById('log-console') as HTMLDivElement;

// Logging helper
function log(message: string) {
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logConsole.appendChild(line);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// Update the state display in real-time
function updateStateDisplay() {
  const state = getQueueState();
  statePending.textContent = state.pending.toString();
  
  if (state.active) {
    stateActive.textContent = 'Active';
    stateActive.className = 'value badge-active';
  } else {
    stateActive.textContent = 'Inactive';
    stateActive.className = 'value badge-inactive';
  }
}

// Set up periodic/event-driven state updates
setInterval(updateStateDisplay, 100);

// Enqueue single toast
btnEnqueue.addEventListener('click', async () => {
  const text = toastTextInput.value;
  const durationVal = toastDurationSelect.value;
  const position = toastPositionSelect.value as 'top' | 'center' | 'bottom';

  let duration: number | 'short' | 'long' = 2000;
  if (durationVal === 'short' || durationVal === 'long') {
    duration = durationVal;
  } else {
    duration = parseInt(durationVal, 10);
  }

  log(`Enqueuing: "${text}" (duration: ${duration}, position: ${position})`);
  updateStateDisplay();

  try {
    await enqueueToast({ text, duration, position });
    log(`Finished: "${text}"`);
  } catch (err) {
    log(`Error: "${text}" failed: ${err}`);
  }
  updateStateDisplay();
});

// Enqueue burst
btnEnqueueBurst.addEventListener('click', () => {
  log('Starting burst of 5 toasts...');
  const durationVal = toastDurationSelect.value;
  const position = toastPositionSelect.value as 'top' | 'center' | 'bottom';

  let duration: number | 'short' | 'long' = 2000;
  if (durationVal === 'short' || durationVal === 'long') {
    duration = durationVal;
  } else {
    duration = parseInt(durationVal, 10);
  }

  for (let i = 1; i <= 5; i++) {
    const text = `Burst Toast #${i}`;
    log(`Enqueuing synchronously: "${text}"`);
    enqueueToast({ text, duration, position })
      .then(() => log(`Finished: "${text}"`))
      .catch((err) => log(`Error: "${text}" failed: ${err}`));
  }
  updateStateDisplay();
});

// Drain queue
btnDrain.addEventListener('click', async () => {
  log('Awaiting queue drain...');
  drainStatus.textContent = 'Draining...';
  updateStateDisplay();
  
  const startTime = Date.now();
  await drainToastQueue();
  
  const elapsed = Date.now() - startTime;
  drainStatus.textContent = `Drained in ${elapsed}ms!`;
  log('Queue completely drained.');
  updateStateDisplay();
});

log('Toast Queue Manager Initialized.');
updateStateDisplay();
