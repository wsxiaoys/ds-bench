/**
 * A browser-only utility that records activity events for the current page
 * session. It is intentionally NOT serializable and must only ever be
 * constructed in the browser.
 */
export class ActivityRecorder {
  private events: string[] = [];
  private startedAt: number;

  constructor() {
    if (typeof window === 'undefined') {
      throw new Error('ActivityRecorder can only be created in the browser');
    }
    this.startedAt = window.performance.now();
  }

  /** Record a single event; returns the new total number of events. */
  record(label: string): number {
    this.events.push(label);
    return this.events.length;
  }

  /** The number of events recorded so far in this session. */
  get count(): number {
    return this.events.length;
  }
}
