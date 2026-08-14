import { DurableObject } from "cloudflare:workers";

export interface Tick {
  seq: number;
  value: number;
  alert: boolean;
}

export class MetricsServer extends DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private controllers: Set<ReadableStreamDefaultController> = new Set();
  private timer: any = null;

  // Cached state in memory
  private initialized = false;
  private running = false;
  private seq = 0;
  private minValue: number | null = null;
  private maxValue: number | null = null;
  private alertCount = 0;
  private threshold: number | null = null;
  private history: Tick[] = [];

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.storage = state.storage;
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    this.running = (await this.storage.get<boolean>("running")) ?? false;
    this.seq = (await this.storage.get<number>("seq")) ?? 0;
    
    const minVal = await this.storage.get<number>("minValue");
    this.minValue = minVal !== undefined ? minVal : null;

    const maxVal = await this.storage.get<number>("maxValue");
    this.maxValue = maxVal !== undefined ? maxVal : null;

    this.alertCount = (await this.storage.get<number>("alertCount")) ?? 0;
    
    const thresh = await this.storage.get<number>("threshold");
    this.threshold = thresh !== undefined ? thresh : null;

    this.history = (await this.storage.get<Tick[]>("history")) ?? [];

    if (this.running) {
      this.startTimer();
    }
  }

  private startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    this.seq += 1;
    const value = Math.floor(Math.random() * 100) + 1;

    if (this.minValue === null) {
      this.minValue = value;
    } else {
      this.minValue = Math.min(this.minValue, value);
    }

    if (this.maxValue === null) {
      this.maxValue = value;
    } else {
      this.maxValue = Math.max(this.maxValue, value);
    }

    let alert = false;
    if (this.threshold !== null && value > this.threshold) {
      alert = true;
      this.alertCount += 1;
    }

    const newTick: Tick = { seq: this.seq, value, alert };
    this.history.unshift(newTick);
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100);
    }

    // Persist to storage
    await this.storage.put("seq", this.seq);
    await this.storage.put("minValue", this.minValue);
    await this.storage.put("maxValue", this.maxValue);
    await this.storage.put("alertCount", this.alertCount);
    await this.storage.put("history", this.history);

    this.broadcast();
  }

  private broadcast() {
    const payload = JSON.stringify(this.getStatePayload());
    for (const controller of this.controllers) {
      try {
        controller.enqueue(`data: ${payload}\n\n`);
      } catch (e) {
        this.controllers.delete(controller);
      }
    }
  }

  private getStatePayload() {
    return {
      running: this.running,
      seq: this.seq,
      minValue: this.minValue,
      maxValue: this.maxValue,
      alertCount: this.alertCount,
      threshold: this.threshold,
      history: this.history,
    };
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();

    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/start")) {
      if (!this.running) {
        this.running = true;
        await this.storage.put("running", true);
        this.startTimer();
        this.broadcast();
      }
      return Response.json({ success: true, ...this.getStatePayload() });
    }

    if (path.endsWith("/stop")) {
      if (this.running) {
        this.running = false;
        await this.storage.put("running", false);
        this.stopTimer();
        this.broadcast();
      }
      return Response.json({ success: true, ...this.getStatePayload() });
    }

    if (path.endsWith("/threshold")) {
      const body: any = await request.json();
      const val = body.threshold;
      this.threshold = typeof val === "number" ? val : null;
      await this.storage.put("threshold", this.threshold);
      this.broadcast();
      return Response.json({ success: true, ...this.getStatePayload() });
    }

    if (path.endsWith("/state")) {
      return Response.json(this.getStatePayload());
    }

    if (path.endsWith("/stream")) {
      let activeController: ReadableStreamDefaultController | null = null;
      const stream = new ReadableStream({
        start: (controller) => {
          activeController = controller;
          this.controllers.add(controller);
          const payload = JSON.stringify(this.getStatePayload());
          controller.enqueue(`data: ${payload}\n\n`);
        },
        cancel: () => {
          if (activeController) {
            this.controllers.delete(activeController);
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

    return new Response("Not Found", { status: 404 });
  }
}
