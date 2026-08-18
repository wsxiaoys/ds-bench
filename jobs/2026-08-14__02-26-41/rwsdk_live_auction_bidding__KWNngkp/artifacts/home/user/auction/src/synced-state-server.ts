import { SyncedStateServer as BaseSyncedStateServer } from "rwsdk/use-synced-state/worker";
import { createDb } from "rwsdk/db";
import type { Database } from "./db";

export class SyncedStateServer extends BaseSyncedStateServer {
  // Declare properties so TypeScript knows they exist
  state!: DurableObjectState;
  env!: any;
  storage!: DurableObjectStorage;

  private initializedPromise: Promise<void> | null = null;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async ensureInitialized() {
    if (!this.initializedPromise) {
      this.initializedPromise = this.initializeAuction();
    }
    return this.initializedPromise;
  }

  async initializeAuction() {
    const itemId = this.state.id.name || "unknown";

    // Warm up state storage cache
    const timeLeft = await this.getState("timeLeft");
    if (timeLeft !== undefined) {
      return;
    }

    // Check if the auction is already closed in the database
    const db = createDb<Database>(this.env.DB);
    const dbResult = await db.selectFrom("auctions")
      .selectAll()
      .where("itemId", "=", itemId)
      .executeTakeFirst();

    if (dbResult && dbResult.closed) {
      await this.setState(0, "timeLeft");
      await this.setState(dbResult.winningAmount, "currentBid");
      await this.setState(dbResult.winningBidder || "", "highBidder");
      await this.setState(true, "closed");
      return;
    }

    const isLot42 = itemId === "lot-42";
    const duration = isLot42 ? 25 : 60;
    const startingPrice = isLot42 ? 50 : 10;

    await this.setState(duration, "timeLeft");
    await this.setState(startingPrice, "currentBid");
    await this.setState("", "highBidder");
    await this.setState(false, "closed");

    // Start the countdown alarm
    await this.storage.setAlarm(Date.now() + 1000);
  }

  override async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    return super.fetch(request);
  }

  async alarm() {
    await this.ensureInitialized();

    const timeLeft = await this.getState("timeLeft");
    if (typeof timeLeft === "number" && timeLeft > 0) {
      const nextTimeLeft = timeLeft - 1;
      await this.setState(nextTimeLeft, "timeLeft");

      if (nextTimeLeft > 0) {
        await this.storage.setAlarm(Date.now() + 1000);
      } else {
        await this.setState(true, "closed");

        const itemId = this.state.id.name || "unknown";
        const winningAmount = await this.getState("currentBid") || 0;
        const winningBidder = await this.getState("highBidder") || "";

        const db = createDb<Database>(this.env.DB);
        await db.insertInto("auctions")
          .values({
            itemId,
            winningBidder: String(winningBidder),
            winningAmount: Number(winningAmount),
            closed: 1
          })
          .onConflict((oc) => oc.column("itemId").doUpdateSet({
            winningBidder: String(winningBidder),
            winningAmount: Number(winningAmount),
            closed: 1
          }))
          .execute();
      }
    }
  }

  async submitBid(bidderName: string, amount: number): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();

    const closed = await this.getState("closed");
    if (closed) {
      return { success: false, error: "Auction is closed" };
    }

    const timeLeft = await this.getState("timeLeft");
    if (typeof timeLeft === "number" && timeLeft <= 0) {
      return { success: false, error: "Auction has ended" };
    }

    const currentBid = await this.getState("currentBid");
    const itemId = this.state.id.name || "unknown";
    const isLot42 = itemId === "lot-42";
    const startingPrice = isLot42 ? 50 : 10;

    const currentBidAmount = typeof currentBid === "number" ? currentBid : Number(currentBid);

    if (amount < startingPrice) {
      return { success: false, error: `Bid must be at least $${startingPrice}` };
    }

    const highBidder = await this.getState("highBidder");
    if (highBidder && highBidder !== "") {
      if (amount <= currentBidAmount) {
        return { success: false, error: `Bid must be strictly greater than current bid of $${currentBidAmount}` };
      }
    }

    await this.setState(amount, "currentBid");
    await this.setState(bidderName, "highBidder");

    return { success: true };
  }
}
