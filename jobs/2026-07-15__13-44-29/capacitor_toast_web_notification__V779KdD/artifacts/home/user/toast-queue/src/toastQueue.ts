import { Toast } from '@capacitor/toast';

// Define the custom element <pwa-toast> to ensure it has the correct properties and styling
class PwaToast extends HTMLElement {
  private _text: string = '';
  private _message: string = '';
  private container: HTMLDivElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    this.container = document.createElement('div');
    this.container.className = 'toast-inner';

    const style = document.createElement('style');
    style.textContent = `
      .toast-inner {
        padding: 12px 24px;
        background-color: #323232;
        color: #ffffff;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 3px 5px -1px rgba(0,0,0,.2), 0 6px 10px 0 rgba(0,0,0,.14), 0 1px 18px 0 rgba(0,0,0,.12);
        max-width: 80vw;
        word-break: break-word;
        text-align: center;
      }
    `;
    shadow.appendChild(style);
    shadow.appendChild(this.container);
  }

  get text() {
    return this._text;
  }

  set text(val: string) {
    this._text = val;
    this.container.textContent = val;
    this.setAttribute('text', val);
  }

  get message() {
    return this._message;
  }

  set message(val: string) {
    this._message = val;
    this.text = val;
    this.setAttribute('message', val);
  }
}

if (!customElements.get('pwa-toast')) {
  customElements.define('pwa-toast', PwaToast);
}

// Queue options interface
export interface EnqueueToastOptions {
  text: string;
  duration?: number | 'short' | 'long';
  position?: 'top' | 'center' | 'bottom';
}

// Internal Queue Item interface
interface QueueItem {
  text: string;
  duration: number;
  position: 'top' | 'center' | 'bottom';
  resolve: () => void;
  reject: (err: any) => void;
}

// Internal state
const queue: QueueItem[] = [];
let isProcessing = false;
let active = false;
const drainPromises: (() => void)[] = [];

// Helper to resolve drain promises when queue is empty and no toast is active
function resolveDrainPromises() {
  if (queue.length === 0 && !active) {
    while (drainPromises.length > 0) {
      const resolve = drainPromises.shift();
      if (resolve) resolve();
    }
  }
}

// Process the queue sequentially
async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;
  active = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;

    let toastElement: any = null;

    try {
      // Trigger the Capacitor Toast web plugin show method
      await Toast.show({
        text: item.text,
        duration: item.duration >= 3500 ? 'long' : 'short',
      });

      // Find the newly created pwa-toast element
      toastElement = document.querySelector('pwa-toast');
      if (toastElement) {
        toastElement.setAttribute('data-position', item.position);
        // Force text property if not already synchronized
        if (toastElement.text !== item.text) {
          toastElement.text = item.text;
        }
      }

      // Wait for the duration to elapse
      await new Promise<void>((resolve) => setTimeout(resolve, item.duration));

      // Remove the element from document
      if (toastElement && toastElement.parentNode) {
        toastElement.remove();
      } else {
        const remaining = document.querySelector('pwa-toast');
        if (remaining) {
          remaining.remove();
        }
      }

      item.resolve();
    } catch (err) {
      // Cleanup element on failure
      if (toastElement && toastElement.parentNode) {
        toastElement.remove();
      }
      item.reject(err);
    }
  }

  active = false;
  isProcessing = false;
  resolveDrainPromises();
}

// Public API Implementation
export function enqueueToast(options: EnqueueToastOptions): Promise<void> {
  const text = options.text || '';
  
  let duration = 2000;
  if (options.duration === 'short') {
    duration = 2000;
  } else if (options.duration === 'long') {
    duration = 3500;
  } else if (typeof options.duration === 'number') {
    duration = options.duration;
  }

  const position = options.position || 'bottom';

  return new Promise<void>((resolve, reject) => {
    queue.push({ text, duration, position, resolve, reject });
    processQueue();
  });
}

export function drainToastQueue(): Promise<void> {
  if (queue.length === 0 && !active) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    drainPromises.push(resolve);
  });
}

export function getQueueState(): { pending: number; active: boolean } {
  return {
    pending: queue.length,
    active: active,
  };
}
