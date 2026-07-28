import { DurableObject } from "cloudflare:workers";

export type AuctionWinner = {
  name: string;
  amount: number;
};

export type AuctionSnapshot = {
  itemId: string;
  name: string;
  startingPrice: number;
  durationSeconds: number;
  highestBid: number | null;
  highestBidder: string | null;
  timeLeft: number;
  closed: boolean;
  winner: AuctionWinner | null;
};

type AuctionState = {
  itemId: string;
  name: string;
  startingPrice: number;
  durationSeconds: number;
  highestBid: number | null;
  highestBidder: string | null;
  startTime: number;
  endTime: number;
  closed: boolean;
  winner: AuctionWinner | null;
};

// Item defaults. `lot-42` is the one seeded/checked item; every other item id
// gets a generic default so that `/auction/:itemId` works for any id.
const ITEM_DEFAULTS: Record<
  string,
  { name: string; startingPrice: number; durationSeconds: number }
> = {
  "lot-42": {
    name: "Sunburst Electric Guitar",
    startingPrice: 50,
    durationSeconds: 25,
  },
};

const DEFAULT_ITEM = {
  name: "Mystery Item",
  startingPrice: 10,
  durationSeconds: 60,
};

const STATE_KEY = "auction-state";
const SYNCED_STATE_KEY = "auction";

function getDefaultsFor(itemId: string) {
  return ITEM_DEFAULTS[itemId] ?? { ...DEFAULT_ITEM };
}

function toSnapshot(state: AuctionState): AuctionSnapshot {
  const now = Date.now();
  const rawSecondsLeft = (state.endTime - now) / 1000;
  const timeLeft = state.closed
    ? 0
    : Math.max(0, Math.ceil(rawSecondsLeft - 1e-6));
  return {
    itemId: state.itemId,
    name: state.name,
    startingPrice: state.startingPrice,
    durationSeconds: state.durationSeconds,
    highestBid: state.highestBid,
    highestBidder: state.highestBidder,
    timeLeft,
    closed: state.closed,
    winner: state.winner,
  };
}

export class AuctionRoom extends DurableObject<Env> {
  private async loadState(itemId: string): Promise<AuctionState> {
    let state = await this.ctx.storage.get<AuctionState>(STATE_KEY);
    if (!state) {
      const defaults = getDefaultsFor(itemId);
      const now = Date.now();
      state = {
        itemId,
        name: defaults.name,
        startingPrice: defaults.startingPrice,
        durationSeconds: defaults.durationSeconds,
        highestBid: null,
        highestBidder: null,
        startTime: now,
        endTime: now + defaults.durationSeconds * 1000,
        closed: false,
        winner: null,
      };
      await this.ctx.storage.put(STATE_KEY, state);
      // Kick off the first tick of the server-driven countdown right away.
      await this.ctx.storage.setAlarm(now + 1000);
    }
    return state;
  }

  private async persist(state: AuctionState) {
    await this.ctx.storage.put(STATE_KEY, state);
  }

  private async broadcast(state: AuctionState) {
    try {
      const id = this.env.SYNCED_STATE_SERVER.idFromName(state.itemId);
      const stub = this.env.SYNCED_STATE_SERVER.get(id);
      await stub.setState(toSnapshot(state), SYNCED_STATE_KEY);
    } catch (err) {
      // Never let a broadcast failure break bid handling; the client that
      // just bid still gets its own result via the direct RPC return value,
      // and other clients will catch up on their next poll/reconnect.
      console.error("[AuctionRoom] broadcast failed", err);
    }
  }

  private maybeClose(state: AuctionState): boolean {
    if (state.closed) return false;
    if (Date.now() >= state.endTime) {
      state.closed = true;
      state.winner = state.highestBidder
        ? { name: state.highestBidder, amount: state.highestBid! }
        : null;
      return true;
    }
    return false;
  }

  async getSnapshot(itemId: string): Promise<AuctionSnapshot> {
    const state = await this.loadState(itemId);
    if (this.maybeClose(state)) {
      await this.persist(state);
    }
    return toSnapshot(state);
  }

  async placeBid(
    itemId: string,
    bidderName: string,
    amount: number,
  ): Promise<{ ok: boolean; error?: string; snapshot: AuctionSnapshot }> {
    const state = await this.loadState(itemId);
    const closedNow = this.maybeClose(state);
    if (closedNow) {
      await this.persist(state);
      await this.broadcast(state);
    }

    const name = (bidderName ?? "Anonymous").toString().trim() || "Anonymous";

    if (state.closed) {
      return {
        ok: false,
        error: "The auction is closed.",
        snapshot: toSnapshot(state),
      };
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || !Number.isInteger(numericAmount)) {
      return {
        ok: false,
        error: "Enter a whole dollar amount.",
        snapshot: toSnapshot(state),
      };
    }

    const meetsStartingPrice = numericAmount >= state.startingPrice;
    const meetsHighestBid =
      state.highestBid === null || numericAmount > state.highestBid;

    if (!meetsStartingPrice || !meetsHighestBid) {
      const minimum =
        state.highestBid === null
          ? state.startingPrice
          : state.highestBid + 1;
      return {
        ok: false,
        error: `Bid must be at least $${minimum}.`,
        snapshot: toSnapshot(state),
      };
    }

    state.highestBid = numericAmount;
    state.highestBidder = name;
    await this.persist(state);
    await this.broadcast(state);

    return { ok: true, snapshot: toSnapshot(state) };
  }

  async alarm() {
    const state = await this.ctx.storage.get<AuctionState>(STATE_KEY);
    if (!state || state.closed) {
      return;
    }

    const justClosed = this.maybeClose(state);
    await this.persist(state);
    await this.broadcast(state);

    if (!justClosed) {
      // Reschedule ourselves for the next second so the countdown keeps
      // ticking independently of whether any client is connected.
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }
}
