import React from "react";
import { AuctionRoom } from "./auction-room";

interface AuctionPageProps {
  itemId: string;
  clientName: string;
  initialData: {
    closed: boolean;
    winnerName: string;
    winningAmount: number;
    timeLeft: number;
    currentBid: number;
    highBidder: string;
  };
}

export function AuctionPage({ itemId, clientName, initialData }: AuctionPageProps) {
  return (
    <AuctionRoom
      itemId={itemId}
      clientName={clientName}
      initialData={initialData}
    />
  );
}
