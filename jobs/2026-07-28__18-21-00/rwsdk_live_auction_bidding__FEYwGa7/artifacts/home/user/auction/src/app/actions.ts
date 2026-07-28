"use server";

import { env } from "cloudflare:workers";

export async function placeBidAction(itemId: string, bidderName: string, bidAmount: number) {
  try {
    const namespace = env.SYNCED_STATE_SERVER;
    if (!namespace) {
      return { success: false, error: "SYNCED_STATE_SERVER binding is missing" };
    }
    const id = namespace.idFromName(itemId);
    const stub = namespace.get(id);

    // Call the RPC method on the Durable Object!
    await stub.placeBid(bidderName, bidAmount);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}
