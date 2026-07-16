import { Toast } from '@capacitor/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastPosition = 'top' | 'center' | 'bottom';
type ToastDuration = number | 'short' | 'long';

interface EnqueueOptions {
  text: string;
  duration?: ToastDuration;
  position?: ToastPosition;
}

interface QueueItem {
  text: string;
  duration: number; // resolved to milliseconds
  position: ToastPosition;
  resolve: () => void;
}

interface QueueState {
  pending: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Toast Queue Manager
// ---------------------------------------------------------------------------

/**
 * A queue manager that serializes `Toast.show(...)` calls so that toasts are
 * displayed strictly one after another (never overlapping), with configurable
 * per-toast display duration and screen position.
 *
 * The real `@capacitor/toast` web implementation appends a `<pwa-toast>` element
 * to `document.body` and resolves immediately — it does not wait for the toast
 * to finish and never removes the element. This manager owns the display
 * timing and element cleanup, chaining toasts with promises/timers so the next
 * toast starts only after the current one's duration has fully elapsed and its
 * element has been removed.
 */
class ToastQueueManager {
  private queue: QueueItem[] = [];
  private active = false;

  // Resolvers for all pending drainToastQueue() promises.
  private drainResolvers: Array<() => void> = [];

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Enqueue a toast for sequential display.
   *
   * Returns a `Promise<void>` that resolves ONLY after this specific toast has
   * been displayed for its full duration AND its `<pwa-toast>` element has been
   * removed from the DOM.
   */
  enqueueToast(options: EnqueueOptions): Promise<void> {
    const text = options.text;
    const position: ToastPosition = options.position ?? 'bottom';
    const duration = this.resolveDuration(options.duration);

    return new Promise<void>((resolve) => {
      this.queue.push({ text, duration, position, resolve });
      this.process();
    });
  }

  /**
   * Returns a `Promise<void>` that resolves when the queue is empty and no toast
   * is currently active. If called while already idle, resolves immediately.
   */
  drainToastQueue(): Promise<void> {
    if (!this.active && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  /**
   * Returns synchronously the current queue state.
   */
  getQueueState(): QueueState {
    return {
      pending: this.queue.length,
      active: this.active,
    };
  }

  // -----------------------------------------------------------------------
  // Internal logic
  // -----------------------------------------------------------------------

  /**
   * Convert the `duration` option to milliseconds.
   *  - `'short'` → 2000
   *  - `'long'`  → 3500
   *  - number    → that many milliseconds
   *  - omitted   → 2000 (default)
   */
  private resolveDuration(duration: ToastDuration | undefined): number {
    if (duration === 'long') return 3500;
    if (duration === 'short') return 2000;
    if (typeof duration === 'number' && duration > 0) return duration;
    return 2000;
  }

  /**
   * Process the next item in the queue. If a toast is already active, this is a
   * no-op — the active toast's completion will call `process()` again.
   *
   * If the queue is empty and nothing is active, resolve any pending drain
   * promises.
   */
  private process(): void {
    if (this.active) return;

    const item = this.queue.shift();
    if (!item) {
      // Queue is empty and nothing is active — resolve drain promises.
      this.resolveDrains();
      return;
    }

    this.active = true;

    // Display the toast, then resolve its enqueue promise and process the next.
    this.displayToast(item).then(() => {
      this.active = false;
      item.resolve();
      this.process();
    });
  }

  /**
   * Display a single toast: call the real `Toast.show(...)`, set the
   * `data-position` attribute and `text` property on the created element, wait
   * for the configured duration, then remove the element.
   */
  private async displayToast(item: QueueItem): Promise<void> {
    // Use the real Toast.show() API — this appends a <pwa-toast> element to
    // document.body. The plugin's own `duration` ('short'/'long') is irrelevant
    // because we own the timing; we pass 'short' as a harmless default.
    await Toast.show({
      text: item.text,
      duration: 'short',
      position: item.position,
    });

    // The plugin resolves immediately after appending the element, so it is now
    // in the DOM. Find it and decorate it with the data-position attribute and
    // text property required by the display contract.
    const toastEl = document.querySelector('pwa-toast');
    if (toastEl) {
      toastEl.setAttribute('data-position', item.position);
      // The plugin sets `message`; the contract also requires a `text` property.
      (toastEl as any).text = item.text;
    }

    // Wait for the configured display duration.
    await new Promise<void>((resolve) => setTimeout(resolve, item.duration));

    // Remove the element before the next toast can appear.
    if (toastEl && toastEl.parentNode) {
      toastEl.parentNode.removeChild(toastEl);
    }
  }

  /**
   * Resolve all pending drainToastQueue() promises and clear the list.
   */
  private resolveDrains(): void {
    const resolvers = this.drainResolvers;
    this.drainResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}

// ---------------------------------------------------------------------------
// Instantiate and expose on window
// ---------------------------------------------------------------------------

const toastQueue = new ToastQueueManager();

// Expose the API on the global window object for console / automation access.
(window as any).enqueueToast = (options: EnqueueOptions) =>
  toastQueue.enqueueToast(options);
(window as any).drainToastQueue = () => toastQueue.drainToastQueue();
(window as any).getQueueState = () => toastQueue.getQueueState();

// ---------------------------------------------------------------------------
// Demo UI wiring
// ---------------------------------------------------------------------------

const logEl = document.getElementById('log')!;
const stateEl = document.getElementById('state')!;

function log(message: string): void {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function updateState(): void {
  stateEl.textContent = JSON.stringify(toastQueue.getQueueState());
}

// Continuously update the state display.
setInterval(updateState, 100);

document.getElementById('btn-enqueue')!.addEventListener('click', async () => {
  const text = (document.getElementById('toast-text') as HTMLInputElement).value;
  const durationStr = (
    document.getElementById('toast-duration') as HTMLInputElement
  ).value;
  const position = (
    document.getElementById('toast-position') as HTMLSelectElement
  ).value as ToastPosition;

  // Parse duration: 'short', 'long', or a number
  let duration: ToastDuration;
  if (durationStr === 'short' || durationStr === 'long') {
    duration = durationStr;
  } else {
    const n = parseInt(durationStr, 10);
    duration = isNaN(n) ? 2000 : n;
  }

  log(`Enqueueing: "${text}" (${duration}ms, ${position})`);
  await (window as any).enqueueToast({ text, duration, position });
  log(`Finished:   "${text}"`);
  updateState();
});

document.getElementById('btn-burst')!.addEventListener('click', () => {
  for (let i = 1; i <= 5; i++) {
    const text = `Burst toast #${i}`;
    log(`Enqueueing: "${text}"`);
    (window as any)
      .enqueueToast({ text, duration: 1000 })
      .then(() => log(`Finished:   "${text}"`));
  }
  updateState();
});

document.getElementById('btn-drain')!.addEventListener('click', async () => {
  log('Draining queue...');
  await (window as any).drainToastQueue();
  log('Queue drained.');
  updateState();
});

log('Toast Queue Manager ready.');
log('API available on window: enqueueToast, drainToastQueue, getQueueState');
updateState();