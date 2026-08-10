import { SyncedStateServer } from "rwsdk/use-synced-state/worker";
import { saveAuctionResult, getAuctionResult } from "./db.js";

export class AuctionRoomServer extends SyncedStateServer {
  env: any;
  itemId?: string;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.env = env;
  }

  async initializeAuction(itemId: string) {
    this.itemId = itemId;
    await this.ctx.storage.put("itemId", itemId);

    // Check if already closed in DB
    const dbResult = await getAuctionResult(itemId);
    if (dbResult) {
      this.setState(true, "closed");
      this.setState(dbResult.winner_name, "highestBidder");
      this.setState(dbResult.winning_amount, "winning_amount");
      // Set highestBid to winning_amount too for backward compatibility
      this.setState(dbResult.winning_amount, "highestBid");
      this.setState(0, "timeLeft");
      return;
    }

    // Check if countdown already initialized in memory
    let timeLeft = this.getState("timeLeft");
    if (timeLeft === undefined) {
      const duration = itemId === "lot-42" ? 25 : 60;
      const startingPrice = itemId === "lot-42" ? 50 : 10;
      const itemName = itemId === "lot-42" ? "Sunburst Electric Guitar" : `Item ${itemId}`;

      this.setState(itemName, "itemName");
      this.setState(startingPrice, "highestBid");
      this.setState("", "highestBidder");
      this.setState(duration, "timeLeft");
      this.setState(false, "closed");

      // Start the countdown alarm!
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }

  async placeBid(bidderName: string, bidAmount: number) {
    if (!this.itemId) {
      this.itemId = await this.ctx.storage.get<string>("itemId");
    }
    if (!this.itemId) {
      throw new Error("Auction room not initialized");
    }

    // Check if already closed in DB
    const dbResult = await getAuctionResult(this.itemId);
    if (dbResult || this.getState("closed")) {
      throw new Error("Auction is closed");
    }

    const highestBid = this.getState("highestBid") as number;
    const highestBidder = this.getState("highestBidder") as string;

    const startingPrice = this.itemId === "lot-42" ? 50 : 10;
    const hasAcceptedBid = highestBidder !== "";

    if (bidAmount < startingPrice) {
      throw new Error(`Bid must be at least the starting price of $${startingPrice}`);
    }

    if (hasAcceptedBid && bidAmount <= highestBid) {
      throw new Error(`Bid must be strictly greater than the current highest bid of $${highestBid}`);
    }

    // Validation passed! Update state
    this.setState(bidAmount, "highestBid");
    this.setState(bidderName, "highestBidder");

    return { success: true };
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const itemId = parts[parts.length - 1]; // E.g., /__synced-state/lot-42 -> "lot-42"
    if (itemId && itemId !== "__synced-state") {
      await this.initializeAuction(itemId);
    }
    return super.fetch(request);
  }

  async alarm() {
    if (!this.itemId) {
      this.itemId = await this.ctx.storage.get<string>("itemId");
    }
    if (!this.itemId) return;

    let timeLeft = this.getState("timeLeft") as number;
    if (timeLeft === undefined) return;

    if (timeLeft > 0) {
      timeLeft--;
      this.setState(timeLeft, "timeLeft");

      if (timeLeft === 0) {
        this.setState(true, "closed");
        const highestBid = this.getState("highestBid") as number;
        const highestBidder = this.getState("highestBidder") as string;

        // Persist to DB
        await saveAuctionResult(this.itemId, highestBidder, highestBid);
      } else {
        await this.ctx.storage.setAlarm(Date.now() + 1000);
      }
    }
  }
}
