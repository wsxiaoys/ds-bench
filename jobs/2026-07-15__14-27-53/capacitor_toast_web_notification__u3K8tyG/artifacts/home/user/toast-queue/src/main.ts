import { Toast } from '@capacitor/toast';

export interface EnqueueToastOptions {
  text: string;
  duration?: number | 'short' | 'long';
  position?: 'top' | 'center' | 'bottom';
}

interface QueueEntry {
  text: string;
  durationMs: number;
  position: 'top' | 'center' | 'bottom';
  resolve: () => void;
  reject: (err: unknown) => void;
}

export interface QueueState {
  pending: number;
  active: boolean;
}

/**
 * ToastQueueManager serializes Capacitor `Toast.show(...)` calls on the web so
 * that at most one `<pwa-toast>` element is ever visible at a time. Each
 * enqueued toast is shown for its configured duration and then removed from
 * the DOM before the next toast starts.
 */
export class ToastQueueManager {
  private readonly queue: QueueEntry[] = [];
  private active = false;
  private readonly idleResolvers: Array<() => void> = [];

  /** Enqueue a toast. Resolves once this toast has been displayed for its full
   *  duration AND its `<pwa-toast>` element has been removed from the DOM. */
  enqueue(options: EnqueueToastOptions): Promise<void> {
    const text = String(options?.text ?? '');
    const position: 'top' | 'center' | 'bottom' =
      options?.position === 'top' || options?.position === 'center'
        ? options.position
        : 'bottom';
    const durationMs = this.resolveDuration(options?.duration);

    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = { text, durationMs, position, resolve, reject };
      this.queue.push(entry);
      // Kick the processor in case we are idle. Safe to call repeatedly; it
      // is a no-op while another toast is being displayed.
      this.scheduleNext();
    });
  }

  /** Returns a promise that resolves once the queue is empty AND no toast is
   *  currently being displayed. Resolves immediately when already idle. */
  drain(): Promise<void> {
    if (this.queue.length === 0 && !this.active) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  /** Synchronous snapshot of the queue. */
  getState(): QueueState {
    return { pending: this.queue.length, active: this.active };
  }

  private resolveDuration(d: EnqueueToastOptions['duration']): number {
    if (typeof d === 'number' && Number.isFinite(d) && d >= 0) {
      return d;
    }
    if (d === 'long') return 3500;
    // 'short' or undefined
    return 2000;
  }

  private scheduleNext(): void {
    if (this.active) return;
    if (this.queue.length === 0) {
      this.flushIdleResolvers();
      return;
    }
    const entry = this.queue.shift() as QueueEntry;
    this.active = true;
    // We deliberately do not await this here so scheduleNext returns
    // synchronously. The continuation handles the active flag.
    this.displayToast(entry).finally(() => {
      this.active = false;
      if (this.queue.length === 0) {
        this.flushIdleResolvers();
      } else {
        this.scheduleNext();
      }
    });
  }

  private flushIdleResolvers(): void {
    if (this.idleResolvers.length === 0) return;
    const resolvers = this.idleResolvers.splice(0, this.idleResolvers.length);
    for (const r of resolvers) r();
  }

  private async displayToast(entry: QueueEntry): Promise<void> {
    let element: HTMLElement | null = null;
    try {
      // Use the real Toast.show — this appends a <pwa-toast> element to
      // document.body. The web implementation resolves immediately after
      // appending; we own the actual display timing.
      await Toast.show({
        text: entry.text,
        duration: entry.durationMs >= 3500 ? 'long' : 'short',
        position: entry.position,
      });

      // After the plugin has appended the element, locate it. Because the
      // queue guarantees at most one <pwa-toast> at a time, the (only)
      // current element is the one we just appended.
      element = this.findCurrentToastElement();
      if (element) {
        // The plugin sets `message`; the spec also wants `text` available.
        (element as unknown as { text?: string }).text = entry.text;
        element.setAttribute('data-position', entry.position);
      }

      // Hold the toast visible for the configured duration.
      await delay(entry.durationMs);

      // Remove the element BEFORE starting the next toast so that no two
      // <pwa-toast> elements ever coexist.
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }

      entry.resolve();
    } catch (err) {
      // Best-effort cleanup if something failed mid-flight.
      const live = element ?? this.findCurrentToastElement();
      if (live && live.parentNode) {
        try {
          live.parentNode.removeChild(live);
        } catch {
          /* ignore */
        }
      }
      entry.reject(err);
    }
  }

  private findCurrentToastElement(): HTMLElement | null {
    // There must be at most one <pwa-toast> in the DOM at any time; pick it.
    return document.querySelector('pwa-toast');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Bootstrap: create a single manager and expose it on `window`.
const manager = new ToastQueueManager();

declare global {
  interface Window {
    enqueueToast: (options: EnqueueToastOptions) => Promise<void>;
    drainToastQueue: () => Promise<void>;
    getQueueState: () => QueueState;
  }
}

window.enqueueToast = (options) => manager.enqueue(options);
window.drainToastQueue = () => manager.drain();
window.getQueueState = () => manager.getState();

// Convenience buttons for manual exploration.
const logEl = document.getElementById('log') as HTMLPreElement | null;
function log(...parts: unknown[]): void {
  if (!logEl) return;
  const line = parts
    .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
    .join(' ');
  logEl.textContent = `${new Date().toISOString()} ${line}\n${logEl.textContent ?? ''}`;
}

document.getElementById('enqueueSample')?.addEventListener('click', () => {
  void window.enqueueToast({ text: 'Hello 1', duration: 1500 });
  void window.enqueueToast({ text: 'Hello 2', duration: 1500 });
  void window.enqueueToast({ text: 'Hello 3', duration: 1500 });
});
document.getElementById('enqueueBurst')?.addEventListener('click', () => {
  for (let i = 0; i < 10; i++) {
    void window.enqueueToast({ text: `Burst #${i}`, duration: 800 });
  }
});
document.getElementById('drain')?.addEventListener('click', () => {
  void window.drainToastQueue().then(() => log('queue drained'));
});
document.getElementById('state')?.addEventListener('click', () => {
  log('state', window.getQueueState());
});