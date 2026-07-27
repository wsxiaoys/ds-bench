import { DurableObject } from "cloudflare:workers";

const HISTORY_LIMIT = 50;
const TICK_INTERVAL_MS = 1000;

export type Tick = {
  seq: number;
  value: number;
  alert: boolean;
};

export type MetricsState = {
  running: boolean;
  seq: number;
  tickCount: number;
  min: number | null;
  max: number | null;
  alertCount: number;
  threshold: number | null;
  history: Tick[];
};

const DEFAULT_STATE: MetricsState = {
  running: false,
  seq: 0,
  tickCount: 0,
  min: null,
  max: null,
  alertCount: 0,
  threshold: null,
  history: [],
};

/**
 * A single, shared Durable Object instance that owns the metrics tick stream.
 *
 * All browsers talk to the same instance (looked up by a fixed name), so the
 * stream, its counters, and its history are identical for every client.
 * Ticks are produced by the Durable Object's `alarm()` handler, which keeps
 * firing roughly once per second on the server for as long as the stream is
 * "running" -- independent of whether any browser is currently connected.
 */
export class MetricsDO extends DurableObject {
  private state: MetricsState | null = null;

  private async loadState(): Promise<MetricsState> {
    if (this.state) {
      return this.state;
    }
    const stored = await this.ctx.storage.get<MetricsState>("state");
    this.state = stored
      ? { ...DEFAULT_STATE, ...stored }
      : { ...DEFAULT_STATE, history: [] };
    return this.state;
  }

  private async saveState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put("state", this.state);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const state = await this.loadState();

    if (url.pathname === "/state" && request.method === "GET") {
      return Response.json(state);
    }

    if (url.pathname === "/start" && request.method === "POST") {
      if (!state.running) {
        state.running = true;
        await this.saveState();
        const existingAlarm = await this.ctx.storage.getAlarm();
        if (existingAlarm === null) {
          await this.ctx.storage.setAlarm(Date.now() + TICK_INTERVAL_MS);
        }
      }
      return Response.json(state);
    }

    if (url.pathname === "/stop" && request.method === "POST") {
      state.running = false;
      await this.saveState();
      return Response.json(state);
    }

    if (url.pathname === "/threshold" && request.method === "POST") {
      let body: { threshold?: unknown } = {};
      try {
        body = await request.json();
      } catch {
        // ignore malformed body
      }
      const threshold = Number(body.threshold);
      if (Number.isFinite(threshold)) {
        state.threshold = threshold;
        await this.saveState();
      }
      return Response.json(state);
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const state = await this.loadState();

    if (!state.running) {
      // Explicitly stopped; do not produce a tick or reschedule.
      return;
    }

    state.seq += 1;
    const value = 1 + Math.floor(Math.random() * 100); // 1..100 inclusive
    const alert = state.threshold !== null && value > state.threshold;

    state.tickCount += 1;
    state.min = state.min === null ? value : Math.min(state.min, value);
    state.max = state.max === null ? value : Math.max(state.max, value);
    if (alert) {
      state.alertCount += 1;
    }

    state.history.push({ seq: state.seq, value, alert });
    if (state.history.length > HISTORY_LIMIT) {
      state.history = state.history.slice(-HISTORY_LIMIT);
    }

    await this.saveState();

    // Keep advancing on the server regardless of connected clients, until
    // explicitly stopped.
    await this.ctx.storage.setAlarm(Date.now() + TICK_INTERVAL_MS);
  }
}
