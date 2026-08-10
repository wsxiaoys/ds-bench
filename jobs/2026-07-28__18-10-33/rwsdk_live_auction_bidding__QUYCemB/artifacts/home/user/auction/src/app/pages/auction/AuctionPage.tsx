import type { RequestInfo } from "rwsdk/worker";

import { AuctionClient } from "./AuctionClient";
import { getAuctionSnapshot } from "./functions";

export async function AuctionPage({ params, request }: RequestInfo) {
  const itemId = params.itemId as string;
  const url = new URL(request.url);
  const myName = url.searchParams.get("name")?.trim() || "Anonymous";

  const snapshot = await getAuctionSnapshot(itemId);

  return (
    <AuctionClient itemId={itemId} myName={myName} initialSnapshot={snapshot} />
  );
}
