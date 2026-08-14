"use server";

import { env } from "cloudflare:workers";

export async function placeBid(itemId: string, bidderName: string, amount: number) {
  const doId = env.SYNCED_STATE_SERVER.idFromName(itemId);
  const stub = env.SYNCED_STATE_SERVER.get(doId) as any;
  return await stub.submitBid(bidderName, amount);
}
