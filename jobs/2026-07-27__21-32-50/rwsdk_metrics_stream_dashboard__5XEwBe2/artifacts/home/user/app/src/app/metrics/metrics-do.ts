import { DurableObject } from "cloudflare:workers";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Tick {
  seq: number;
  value: number;
  alert: boolean;
}

export interface MetricsState {
  running: boolean;
  seq: number;
  tickCount: number;
  minValue: number | null;
  maxValue: number | null;
  alertCount: number;
  threshold: number | null;
  history: Tick[]; // most recent first
}

interface WSAttachment {
  subscriptions: string[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;
const TICK_INTERVAL_MS = 1000;
const STORAGE_KEY = "metrics_state";

// ── Durable Object ──────────────────────────────────────────────────────────

export class MetricsDurableObject extends DurableObject {
  private state_: MetricsState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // ── HTTP API ────────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade for live state streaming
    if (path === "/ws") {
      return this.handleWebSocketUpgrade();
    }

    // HTTP API endpoints
    if (path === "/start") return this.handleStart();
    if (path === "/stop") return this.handleStop();
    if (path === "/set-threshold" && request.method === "POST") {
      const body: { threshold: number } = await request.json();
      return this.handleSetThreshold(body.threshold);
    }
    if (path === "/state") return this.handleGetState();

    return new Response("Not Found", { status: 404 });
  }

  // ── WebSocket (Hibernation API) ─────────────────────────────────────────

  private handleWebSocketUpgrade(): Response {
    const { 0: client, 1: server } = new WebSocketPair();
    const attachment: WSAttachment = { subscriptions: ["state"] };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    // Clients don't send messages in this protocol; they just listen.
    // But we handle ping/pong or any future commands here.
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    // No cleanup needed; subscriptions live on the attachment.
  }

  async webSocketError(_ws: WebSocket, _error: Error): Promise<void> {
    // No-op
  }

  // ── Alarm (Tick Timer) ──────────────────────────────────────────────────

  async alarm(): Promise<void> {
    const state = await this.getState();
    if (!state.running) return;

    // Produce a tick
    const seq = state.seq + 1;
    const value = Math.floor(Math.random() * 100) + 1;

    // Determine if this is an alert
    const isAlert = state.threshold !== null && value > state.threshold;

    const tick: Tick = { seq, value, alert: isAlert };

    // Update counters
    state.seq = seq;
    state.tickCount = state.tickCount + 1;
    state.minValue =
      state.minValue === null ? value : Math.min(state.minValue, value);
    state.maxValue =
      state.maxValue === null ? value : Math.max(state.maxValue, value);
    if (isAlert) {
      state.alertCount = state.alertCount + 1;
    }

    // Update history (keep most recent at the front)
    state.history.unshift(tick);
    if (state.history.length > MAX_HISTORY) {
      state.history = state.history.slice(0, MAX_HISTORY);
    }

    await this.saveState(state);

    // Broadcast to all connected WebSocket clients
    this.broadcastState(state);

    // Schedule next tick
    if (state.running) {
      await this.ctx.storage.setAlarm(Date.now() + TICK_INTERVAL_MS);
    }
  }

  // ── State Management ────────────────────────────────────────────────────

  private async getState(): Promise<MetricsState> {
    if (this.state_) return this.state_;

    const stored = await this.ctx.storage.get<MetricsState>(STORAGE_KEY);
    if (stored) {
      this.state_ = stored;
      return stored;
    }

    // Default initial state
    const initial: MetricsState = {
      running: false,
      seq: 0,
      tickCount: 0,
      minValue: null,
      maxValue: null,
      alertCount: 0,
      threshold: null,
      history: [],
    };
    this.state_ = initial;
    return initial;
  }

  private async saveState(state: MetricsState): Promise<void> {
    this.state_ = state;
    await this.ctx.storage.put(STORAGE_KEY, state);
  }

  // ── Broadcast ───────────────────────────────────────────────────────────

  private broadcastState(state: MetricsState): void {
    const payload = JSON.stringify({ kind: "state", state });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Socket already closed
      }
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  private async handleStart(): Promise<Response> {
    const state = await this.getState();
    if (!state.running) {
      state.running = true;
      await this.saveState(state);
      // Schedule first tick
      await this.ctx.storage.setAlarm(Date.now() + TICK_INTERVAL_MS);
      this.broadcastState(state);
    }
    return Response.json({ success: true, running: true });
  }

  private async handleStop(): Promise<Response> {
    const state = await this.getState();
    if (state.running) {
      state.running = false;
      await this.saveState(state);
      await this.ctx.storage.deleteAlarm();
      this.broadcastState(state);
    }
    return Response.json({ success: true, running: false });
  }

  private async handleSetThreshold(threshold: number): Promise<Response> {
    const state = await this.getState();
    state.threshold = threshold;
    await this.saveState(state);
    this.broadcastState(state);
    return Response.json({ success: true, threshold });
  }

  private async handleGetState(): Promise<Response> {
    const state = await this.getState();
    return Response.json(state);
  }
}
