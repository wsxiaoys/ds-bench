import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { createDb, SqliteDurableObject } from "rwsdk/db";
import { SyncedStateServer as BaseSyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";
import { type Migration } from "kysely";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { AuctionPage } from "@/app/pages/auction";

// 1. Database Configuration
interface Database {
  auctions: {
    itemId: string;
    winner: string;
    amount: number;
    closed: number;
  };
}

const migrations: Record<string, Migration> = {
  "0001_create_auctions": {
    async up(db) {
      await db.schema
        .createTable("auctions")
        .addColumn("itemId", "text", (col) => col.primaryKey())
        .addColumn("winner", "text")
        .addColumn("amount", "integer")
        .addColumn("closed", "integer")
        .execute();
    },
    async down(db) {
      await db.schema.dropTable("auctions").execute();
    }
  }
};

export class DatabaseServer extends SqliteDurableObject {
  constructor(state: DurableObjectState, env: any) {
    super(state, env, migrations);
  }
}

// 2. Item configuration helper
function getItemConfig(itemId: string) {
  if (itemId === "lot-42") {
    return {
      name: "Sunburst Electric Guitar",
      startingPrice: 50,
      duration: 25,
    };
  }
  return {
    name: `Auction Item ${itemId}`,
    startingPrice: 10,
    duration: 60,
  };
}

// 3. Real-time Synced State Durable Object
export class SyncedStateServer extends BaseSyncedStateServer {
  itemId: string = "";
  env: any;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.env = env;
  }

  async getOrInitializeAuction(itemId: string) {
    this.itemId = itemId;
    await this.ctx.storage.put("itemId", itemId);

    const initialized = this.getState("initialized") as boolean;
    if (initialized) {
      return {
        closed: this.getState("closed") as boolean,
        winnerName: this.getState("winnerName") as string,
        winningAmount: this.getState("winningAmount") as number,
        timeLeft: this.getState("timeLeft") as number,
        currentBid: this.getState("currentBid") as number,
        highBidder: this.getState("highBidder") as string,
      };
    }

    // Restore from DO storage if available
    const storedTimeLeft = await this.ctx.storage.get("timeLeft") as number | undefined;
    if (storedTimeLeft !== undefined) {
      this.setState(await this.ctx.storage.get("itemName"), "itemName");
      this.setState(await this.ctx.storage.get("currentBid"), "currentBid");
      this.setState(await this.ctx.storage.get("highBidder"), "highBidder");
      this.setState(storedTimeLeft, "timeLeft");
      this.setState(await this.ctx.storage.get("closed"), "closed");
      this.setState(await this.ctx.storage.get("winnerName"), "winnerName");
      this.setState(await this.ctx.storage.get("winningAmount"), "winningAmount");
      this.setState(true, "initialized");

      return {
        closed: this.getState("closed") as boolean,
        winnerName: this.getState("winnerName") as string,
        winningAmount: this.getState("winningAmount") as number,
        timeLeft: this.getState("timeLeft") as number,
        currentBid: this.getState("currentBid") as number,
        highBidder: this.getState("highBidder") as string,
      };
    }

    // Check sqlite database
    const db = createDb<Database>(this.env.DB_SERVER);
    const dbResult = await db.selectFrom("auctions")
      .where("itemId", "=", itemId)
      .selectAll()
      .executeTakeFirst();

    if (dbResult && dbResult.closed === 1) {
      this.setState(true, "closed");
      this.setState(dbResult.winner, "winnerName");
      this.setState(dbResult.amount, "winningAmount");
      this.setState(dbResult.amount, "currentBid");
      this.setState(dbResult.winner, "highBidder");
      this.setState(0, "timeLeft");
      this.setState(true, "initialized");

      await this.ctx.storage.put("closed", true);
      await this.ctx.storage.put("winnerName", dbResult.winner);
      await this.ctx.storage.put("winningAmount", dbResult.amount);
      await this.ctx.storage.put("currentBid", dbResult.amount);
      await this.ctx.storage.put("highBidder", dbResult.winner);
      await this.ctx.storage.put("timeLeft", 0);

      return {
        closed: true,
        winnerName: dbResult.winner,
        winningAmount: dbResult.amount,
        timeLeft: 0,
        currentBid: dbResult.amount,
        highBidder: dbResult.winner,
      };
    }

    // Initialize brand new auction
    const config = getItemConfig(itemId);
    this.setState(config.name, "itemName");
    this.setState(config.startingPrice, "currentBid");
    this.setState("", "highBidder");
    this.setState(config.duration, "timeLeft");
    this.setState(false, "closed");
    this.setState("", "winnerName");
    this.setState(0, "winningAmount");
    this.setState(true, "initialized");

    await this.ctx.storage.put("itemName", config.name);
    await this.ctx.storage.put("currentBid", config.startingPrice);
    await this.ctx.storage.put("highBidder", "");
    await this.ctx.storage.put("timeLeft", config.duration);
    await this.ctx.storage.put("closed", false);
    await this.ctx.storage.put("winnerName", "");
    await this.ctx.storage.put("winningAmount", 0);

    // Start alarm for countdown
    await this.ctx.storage.setAlarm(Date.now() + 1000);

    return {
      closed: false,
      winnerName: "",
      winningAmount: 0,
      timeLeft: config.duration,
      currentBid: config.startingPrice,
      highBidder: "",
    };
  }

  async placeBid(name: string, bid: number) {
    const closed = this.getState("closed") as boolean;
    if (closed) {
      return { success: false, error: "Auction is closed" };
    }

    const itemId = await this.ctx.storage.get("itemId") as string;
    const config = getItemConfig(itemId);
    const startingPrice = config.startingPrice;

    const currentBid = this.getState("currentBid") as number;
    const highBidder = this.getState("highBidder") as string;

    if (bid < startingPrice) {
      return { success: false, error: `Bid must be at least $${startingPrice}` };
    }

    if (highBidder && bid <= currentBid) {
      return { success: false, error: `Bid must be strictly greater than current bid of $${currentBid}` };
    }

    this.setState(bid, "currentBid");
    this.setState(name, "highBidder");

    await this.ctx.storage.put("currentBid", bid);
    await this.ctx.storage.put("highBidder", name);

    return { success: true };
  }

  async alarm() {
    const timeLeft = (this.getState("timeLeft") as number) ?? 0;
    if (timeLeft > 1) {
      const nextTime = timeLeft - 1;
      this.setState(nextTime, "timeLeft");
      await this.ctx.storage.put("timeLeft", nextTime);
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    } else {
      this.setState(0, "timeLeft");
      this.setState(true, "closed");
      await this.ctx.storage.put("timeLeft", 0);
      await this.ctx.storage.put("closed", true);

      const currentBid = (this.getState("currentBid") as number) ?? 0;
      const highBidder = (this.getState("highBidder") as string) ?? "";
      const winnerName = highBidder || "No One";
      const winningAmount = highBidder ? currentBid : 0;

      this.setState(winnerName, "winnerName");
      this.setState(winningAmount, "winningAmount");
      await this.ctx.storage.put("winnerName", winnerName);
      await this.ctx.storage.put("winningAmount", winningAmount);

      const itemId = await this.ctx.storage.get("itemId") as string;
      const db = createDb<Database>(this.env.DB_SERVER);
      await db.insertInto("auctions")
        .values({
          itemId: itemId,
          winner: winnerName,
          amount: winningAmount,
          closed: 1,
        })
        .onConflict((oc) => oc.column("itemId").doUpdateSet({
          winner: winnerName,
          amount: winningAmount,
          closed: 1,
        }))
        .execute();
    }
  }
}

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  ...syncedStateRoutes((env: any) => env.SYNCED_STATE_SERVER),
  route("/api/bid", async ({ request }) => {
    try {
      const { itemId, name, bid } = await request.json() as { itemId: string; name: string; bid: number };
      const id = (env as any).SYNCED_STATE_SERVER.idFromName(itemId);
      const stub = (env as any).SYNCED_STATE_SERVER.get(id);
      const result = await stub.placeBid(name, bid);
      return Response.json(result);
    } catch (error: any) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }
  }),
  render(Document, [
    route("/", () => <div>Hello, welcome to the Auction! Go to <a href="/auction/lot-42">lot-42</a> to start.</div>),
    route("/auction/:itemId", async ({ params, request }) => {
      const itemId = params.itemId;
      const url = new URL(request.url);
      const clientName = url.searchParams.get("name") || "Anonymous";

      // Trigger initialization on the DO asynchronously before rendering
      const id = (env as any).SYNCED_STATE_SERVER.idFromName(itemId);
      const stub = (env as any).SYNCED_STATE_SERVER.get(id);
      const initialData = await stub.getOrInitializeAuction(itemId);

      return <AuctionPage itemId={itemId} clientName={clientName} initialData={initialData} />;
    }),
  ]),
]);
