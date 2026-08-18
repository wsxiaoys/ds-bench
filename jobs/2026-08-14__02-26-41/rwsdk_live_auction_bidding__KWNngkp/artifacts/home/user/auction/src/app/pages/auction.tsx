import { AuctionRoomClient } from "./auction-client";

export const AuctionRoom = ({ params, request }: { params: { itemId: string }; request: Request }) => {
  const itemId = params.itemId;
  const url = new URL(request.url);
  const myName = url.searchParams.get("name") || "Anonymous";

  const isLot42 = itemId === "lot-42";
  const itemName = isLot42 ? "Sunburst Electric Guitar" : `Auction Item ${itemId}`;
  const startingPrice = isLot42 ? 50 : 10;
  const duration = isLot42 ? 25 : 60;

  return (
    <AuctionRoomClient
      itemId={itemId}
      itemName={itemName}
      myName={myName}
      startingPrice={startingPrice}
      duration={duration}
    />
  );
};
