"use server";

import { env } from "cloudflare:workers";
import { serverQuery } from "rwsdk/worker";
import type { AuctionSnapshot } from "@/durableObjects/auctionRoom";

function getAuctionRoomStub(itemId: string) {
  const id = env.AUCTION_ROOM.idFromName(itemId);
  return env.AUCTION_ROOM.get(id);
}

// Data-only server query: fetches (and lazily initializes) the current
// auction snapshot for an item. Does not rehydrate/re-render the page.
export const getAuctionSnapshot = serverQuery(
  async (itemId: string): Promise<AuctionSnapshot> => {
    const stub = getAuctionRoomStub(itemId);
    return stub.getSnapshot(itemId);
  },
);

// Data-only server query used to submit a bid. All validation happens on the
// server (inside the Durable Object) — the client cannot bypass it.
export const placeBid = serverQuery(
  async (
    itemId: string,
    bidderName: string,
    amount: number,
  ): Promise<{ ok: boolean; error?: string; snapshot: AuctionSnapshot }> => {
    const stub = getAuctionRoomStub(itemId);
    return stub.placeBid(itemId, bidderName, amount);
  },
);
