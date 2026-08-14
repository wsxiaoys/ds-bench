import { SyncedStateServer } from "rwsdk/use-synced-state/worker";

export class CustomSyncedStateServer extends SyncedStateServer {
  constructor(ctx: any, env: any) {
    super(ctx, env);

    // Load persisted state into the in-memory store on startup
    this.ctx.blockConcurrencyWhile(async () => {
      try {
        const stored = await this.ctx.storage.list();
        for (const [key, value] of stored.entries()) {
          // Use super.setState to populate the in-memory map of the base class
          super.setState(value, key);
        }
      } catch (err) {
        console.error("Error loading persisted state:", err);
      }
    });
  }

  override setState(value: any, key: string): void {
    // Call super.setState to update the in-memory map and notify subscribers
    super.setState(value, key);

    // Persist the state change to local Cloudflare-backed durable storage
    this.ctx.storage.put(key, value).catch((err: any) => {
      console.error(`Failed to persist key ${key}:`, err);
    });

    // Intercept isRunning changes to start/stop the tick producer
    if (key === "isRunning") {
      if (value === true) {
        this.startProducer();
      } else {
        this.stopProducer();
      }
    }
  }

  private startProducer(): void {
    // Schedule an alarm in 1 second
    this.ctx.storage.setAlarm(Date.now() + 1000);
  }

  private stopProducer(): void {
    this.ctx.storage.deleteAlarm();
  }

  async alarm(): Promise<void> {
    const isRunning = this.getState("isRunning");
    if (!isRunning) {
      return;
    }

    // 1. Increment sequence number (seq starts at 1)
    const currentSeq = (this.getState("seq") as number) || 0;
    const nextSeq = currentSeq + 1;
    this.setState(nextSeq, "seq");

    // 2. Generate random value in range 1..100 inclusive
    const value = Math.floor(Math.random() * 100) + 1;
    this.setState(value, "currentValue");

    // 3. Update running tick count
    const tickCount = (this.getState("tickCount") as number || 0) + 1;
    this.setState(tickCount, "tickCount");

    // 4. Update running min and max values
    const currentMin = this.getState("minValue") as number | null;
    const currentMax = this.getState("maxValue") as number | null;
    const nextMin = (currentMin === null || currentMin === undefined) ? value : Math.min(currentMin, value);
    const nextMax = (currentMax === null || currentMax === undefined) ? value : Math.max(currentMax, value);
    this.setState(nextMin, "minValue");
    this.setState(nextMax, "maxValue");

    // 5. Check threshold and alert count
    const threshold = this.getState("threshold") as number | null;
    let isAlert = false;
    if (threshold !== null && threshold !== undefined) {
      if (value > threshold) {
        isAlert = true;
        const alertCount = (this.getState("alertCount") as number || 0) + 1;
        this.setState(alertCount, "alertCount");
      }
    }

    // 6. Append to history (retain at least 50 most recent ticks)
    const history = (this.getState("history") as any[]) || [];
    const newTick = { seq: nextSeq, value, alert: isAlert };
    let nextHistory = [newTick, ...history];
    if (nextHistory.length > 100) { // Keep up to 100 to be safe, but at least 50
      nextHistory = nextHistory.slice(0, 50);
    }
    this.setState(nextHistory, "history");

    // 7. Schedule next alarm in 1 second (roughly 1 tick per second)
    this.ctx.storage.setAlarm(Date.now() + 1000);
  }
}
