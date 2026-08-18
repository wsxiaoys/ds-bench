import { DurableObject } from "cloudflare:workers";

interface Tick {
  seq: number;
  value: number;
  alert: boolean;
}

export class MetricsDO extends DurableObject {
  running = false;
  seq = 0;
  history: Tick[] = [];
  min: number | null = null;
  max: number | null = null;
  alertCount = 0;
  threshold: number | null = null;
  initialized = false;

  clients = new Set<{ send: (data: string) => void }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async ensureInitialized() {
    if (this.initialized) return;
    this.running = (await this.ctx.storage.get("running")) ?? false;
    this.seq = (await this.ctx.storage.get("seq")) ?? 0;
    this.history = (await this.ctx.storage.get("history")) ?? [];
    this.min = (await this.ctx.storage.get("min")) ?? null;
    this.max = (await this.ctx.storage.get("max")) ?? null;
    this.alertCount = (await this.ctx.storage.get("alertCount")) ?? 0;
    this.threshold = (await this.ctx.storage.get("threshold")) ?? null;
    this.initialized = true;
  }

  async saveState() {
    await this.ctx.storage.put({
      running: this.running,
      seq: this.seq,
      history: this.history,
      min: this.min,
      max: this.max,
      alertCount: this.alertCount,
      threshold: this.threshold,
    });
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this.ctx.storage.put("running", true);
    // Schedule first alarm in 1 second
    await this.ctx.storage.setAlarm(Date.now() + 1000);
    this.broadcastState();
  }

  async stop() {
    this.running = false;
    await this.ctx.storage.put("running", false);
    await this.ctx.storage.deleteAlarm();
    this.broadcastState();
  }

  async generateTick() {
    this.seq += 1;
    // value in inclusive range 1..100 chosen on server
    const value = Math.floor(Math.random() * 100) + 1;

    // Check if it's an alert
    const isAlert = this.threshold !== null && value > this.threshold;
    if (isAlert) {
      this.alertCount += 1;
    }

    // Running min and max
    if (this.min === null || value < this.min) {
      this.min = value;
    }
    if (this.max === null || value > this.max) {
      this.max = value;
    }

    const tick: Tick = { seq: this.seq, value, alert: isAlert };
    this.history.unshift(tick);
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100);
    }

    await this.saveState();
    this.broadcastTick(tick);
  }

  broadcastTick(tick: Tick) {
    const data = JSON.stringify({
      type: "tick",
      tick,
      state: {
        running: this.running,
        seq: this.seq,
        min: this.min,
        max: this.max,
        alertCount: this.alertCount,
        threshold: this.threshold,
      },
    });
    for (const client of this.clients) {
      client.send(data);
    }
  }

  broadcastState() {
    const data = JSON.stringify({
      type: "state",
      state: {
        running: this.running,
        seq: this.seq,
        min: this.min,
        max: this.max,
        alertCount: this.alertCount,
        threshold: this.threshold,
        history: this.history,
      },
    });
    for (const client of this.clients) {
      client.send(data);
    }
  }

  async alarm() {
    await this.ensureInitialized();
    if (!this.running) return;

    await this.generateTick();

    // Schedule next alarm in 1000ms
    await this.ctx.storage.setAlarm(Date.now() + 1000);
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const url = new URL(request.url);

    if (url.pathname === "/state" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          running: this.running,
          seq: this.seq,
          min: this.min,
          max: this.max,
          alertCount: this.alertCount,
          threshold: this.threshold,
          history: this.history,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname === "/stream") {
      const self = this;
      let client: { send: (data: string) => void };
      const stream = new ReadableStream({
        start(controller) {
          client = {
            send(data: string) {
              try {
                controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
              } catch (e) {
                self.clients.delete(client);
              }
            },
          };
          self.clients.add(client);

          // Send initial state immediately to synchronize client
          const initialState = JSON.stringify({
            type: "state",
            state: {
              running: self.running,
              seq: self.seq,
              min: self.min,
              max: self.max,
              alertCount: self.alertCount,
              threshold: self.threshold,
              history: self.history,
            },
          });
          client.send(initialState);
        },
        cancel() {
          if (client) {
            self.clients.delete(client);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (url.pathname === "/start" && request.method === "POST") {
      await this.start();
      return new Response("OK");
    }

    if (url.pathname === "/stop" && request.method === "POST") {
      await this.stop();
      return new Response("OK");
    }

    if (url.pathname === "/threshold" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const t = typeof body.threshold === "number" ? body.threshold : null;
        this.threshold = t;
        await this.saveState();
        this.broadcastState();
        return new Response("OK");
      } catch (e) {
        return new Response("Invalid request", { status: 400 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
