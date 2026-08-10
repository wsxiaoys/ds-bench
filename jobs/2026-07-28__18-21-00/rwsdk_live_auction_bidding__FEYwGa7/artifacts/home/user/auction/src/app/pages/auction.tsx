import { getRequestInfo } from "rwsdk/worker";
import { AuctionRoomClient } from "./auctionClient.js";
import { env } from "cloudflare:workers";
import { getAuctionResult } from "../db.js";

export const AuctionRoomPage = async () => {
  const requestInfo = getRequestInfo();
  const itemId = requestInfo.params.itemId;

  // Get the name query parameter, default to "Anonymous"
  const nameParam = requestInfo.query?.name;
  const clientName = Array.isArray(nameParam) ? nameParam[0] : nameParam || "Anonymous";

  // Trigger server-side auction initialization/check
  const namespace = env.SYNCED_STATE_SERVER;
  if (namespace) {
    const id = namespace.idFromName(itemId);
    const stub = namespace.get(id);
    // Call the RPC initialization method
    await stub.initializeAuction(itemId);
  }

  // Also query the DB directly to get the initial closed state if any
  const dbResult = await getAuctionResult(itemId);
  const isClosed = !!dbResult;
  const initialWinner = dbResult ? dbResult.winner_name : "";
  const initialAmount = dbResult ? dbResult.winning_amount : (itemId === "lot-42" ? 50 : 10);

  return (
    <AuctionRoomClient
      itemId={itemId}
      clientName={clientName}
      initialClosed={isClosed}
      initialWinner={initialWinner}
      initialAmount={initialAmount}
    />
  );
};
