import { createDb } from "rwsdk/db";
import { DatabaseSchema } from "./database";
import { DurableObject } from "cloudflare:workers";

export interface AuctionState {
  itemId: string;
  name: string;
  startingPrice: number;
  timeLeft: number;
  currentBid: number;
  highBidder: string;
  closed: boolean;
}

export class AuctionRoom extends DurableObject {
  storage: any;

  constructor(state: any, env: any) {
    super(state, env);
    this.storage = state.storage;
  }

  async getOrInitializeState(itemId: string): Promise<AuctionState> {
    // 1. Check if we have a persisted state in DO storage
    let state = await this.storage.get("state");
    if (state) {
      return state as AuctionState;
    }

    // 2. Check if the closed result is in the database
    const db = createDb<DatabaseSchema>(this.env.DATABASE_SERVER);
    const dbResult = await db.selectFrom("auctions")
      .selectAll()
      .where("itemId", "=", itemId)
      .executeTakeFirst();

    if (dbResult) {
      const isLot42 = itemId === "lot-42";
      state = {
        itemId,
        name: isLot42 ? "Sunburst Electric Guitar" : `Default Item ${itemId}`,
        startingPrice: isLot42 ? 50 : 10,
        timeLeft: 0,
        currentBid: dbResult.winningAmount,
        highBidder: dbResult.winningBidder === "No winner" ? "" : dbResult.winningBidder,
        closed: true,
      };
      await this.storage.put("state", state);
      return state as AuctionState;
    }

    // 3. Initialize new state
    const isLot42 = itemId === "lot-42";
    state = {
      itemId,
      name: isLot42 ? "Sunburst Electric Guitar" : `Default Item ${itemId}`,
      startingPrice: isLot42 ? 50 : 10,
      timeLeft: isLot42 ? 25 : 60,
      currentBid: isLot42 ? 50 : 10,
      highBidder: "",
      closed: false,
    };

    await this.storage.put("state", state);

    // Start the countdown alarm!
    await this.storage.setAlarm(Date.now() + 1000);

    // Push this initial state to SyncedStateServer immediately so clients get it
    const syncedStateId = this.env.SYNCED_STATE_SERVER.idFromName(itemId);
    const syncedStateStub = this.env.SYNCED_STATE_SERVER.get(syncedStateId);
    await syncedStateStub.setState(state, "auction");

    return state as AuctionState;
  }

  async alarm() {
    let state = await this.storage.get("state") as AuctionState | undefined;
    if (!state || state.closed) {
      return;
    }

    if (state.timeLeft > 0) {
      state.timeLeft -= 1;
    }

    if (state.timeLeft === 0) {
      state.closed = true;

      // Persist closed result to database!
      const db = createDb<DatabaseSchema>(this.env.DATABASE_SERVER);
      await db.insertInto("auctions")
        .values({
          itemId: state.itemId,
          winningBidder: state.highBidder || "No winner",
          winningAmount: state.highBidder ? state.currentBid : 0,
          closed: 1,
        })
        .onConflict((oc) => oc.column("itemId").doUpdateSet({
          winningBidder: state.highBidder || "No winner",
          winningAmount: state.highBidder ? state.currentBid : 0,
          closed: 1,
        }))
        .execute();
    } else {
      // Reschedule alarm for 1 second later
      await this.storage.setAlarm(Date.now() + 1000);
    }

    await this.storage.put("state", state);

    // Push updated state to SyncedStateServer
    const syncedStateId = this.env.SYNCED_STATE_SERVER.idFromName(state.itemId);
    const syncedStateStub = this.env.SYNCED_STATE_SERVER.get(syncedStateId);
    await syncedStateStub.setState(state, "auction");
  }

  async placeBid(itemId: string, amount: number, bidder: string) {
    let state = await this.storage.get("state") as AuctionState | undefined;
    if (!state) {
      state = await this.getOrInitializeState(itemId);
    }

    if (state.closed) {
      return { success: false, error: "Auction is already closed" };
    }

    // Server-enforced bid validation:
    // (a) greater than or equal to the starting price
    // (b) strictly greater than the current highest bid
    const hasHighestBid = state.highBidder !== "";
    const isValid = amount >= state.startingPrice && (!hasHighestBid || amount > state.currentBid);

    if (!isValid) {
      let error = "";
      if (amount < state.startingPrice) {
        error = `Bid must be at least the starting price of $${state.startingPrice}`;
      } else {
        error = `Bid must be strictly greater than the current highest bid of $${state.currentBid}`;
      }
      return { success: false, error };
    }

    // Accept the bid!
    state.currentBid = amount;
    state.highBidder = bidder;

    await this.storage.put("state", state);

    // Push updated state to SyncedStateServer
    const syncedStateId = this.env.SYNCED_STATE_SERVER.idFromName(itemId);
    const syncedStateStub = this.env.SYNCED_STATE_SERVER.get(syncedStateId);
    await syncedStateStub.setState(state, "auction");

    return { success: true, state };
  }
}
