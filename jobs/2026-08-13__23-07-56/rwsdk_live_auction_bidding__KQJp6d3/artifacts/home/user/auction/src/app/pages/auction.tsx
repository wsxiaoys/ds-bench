import { env } from "cloudflare:workers";
import { AuctionRoomClient } from "./auctionClient";

export async function AuctionPage({ params, request }: any) {
  const itemId = params.itemId;
  const url = new URL(request.url);
  const myName = url.searchParams.get("name") || "Anonymous";

  // Get or initialize the auction state from the AuctionRoom DO
  const id = env.AUCTION_ROOM.idFromName(itemId);
  const roomStub: any = env.AUCTION_ROOM.get(id);
  const initialState = await roomStub.getOrInitializeState(itemId);

  return (
    <AuctionRoomClient
      itemId={itemId}
      myName={myName}
      initialState={initialState}
    />
  );
}
