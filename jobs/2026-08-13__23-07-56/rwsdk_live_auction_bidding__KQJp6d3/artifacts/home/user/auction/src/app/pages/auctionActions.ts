"use server";

import { env } from "cloudflare:workers";

export async function placeBidAction(itemId: string, amount: number, bidder: string) {
  const id = env.AUCTION_ROOM.idFromName(itemId);
  const roomStub: any = env.AUCTION_ROOM.get(id);
  const result = await roomStub.placeBid(itemId, amount, bidder);
  return result;
}
