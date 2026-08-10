"use client";

import { useState, useTransition } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { placeBidAction } from "../actions.js";

interface AuctionRoomClientProps {
  itemId: string;
  clientName: string;
  initialClosed: boolean;
  initialWinner: string;
  initialAmount: number;
}

export const AuctionRoomClient = ({
  itemId,
  clientName,
  initialClosed,
  initialWinner,
  initialAmount,
}: AuctionRoomClientProps) => {
  const [itemName] = useSyncedState(
    itemId === "lot-42" ? "Sunburst Electric Guitar" : `Item ${itemId}`,
    "itemName",
    itemId
  );

  const [highestBid] = useSyncedState(
    initialAmount,
    "highestBid",
    itemId
  );

  const [highestBidder] = useSyncedState(
    initialWinner,
    "highestBidder",
    itemId
  );

  const [timeLeft] = useSyncedState(
    itemId === "lot-42" ? 25 : 60,
    "timeLeft",
    itemId
  );

  const [closed] = useSyncedState(
    initialClosed,
    "closed",
    itemId
  );

  const [bidValue, setBidValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseInt(bidValue, 10);
    if (isNaN(amount)) {
      setError("Please enter a valid whole number.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await placeBidAction(itemId, clientName, amount);
        if (res.success) {
          setBidValue("");
        } else {
          setError(res.error || "Bid was rejected.");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "600px", margin: "40px auto", border: "1px solid #eaeaea", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
      <h1 data-testid="item-name" style={{ fontSize: "2rem", marginBottom: "20px", color: "#333" }}>{itemName}</h1>

      <div style={{ padding: "10px 15px", backgroundColor: "#f8f9fa", borderRadius: "6px", marginBottom: "20px" }}>
        <strong>Your Identity: </strong>
        <span data-testid="my-name" style={{ fontWeight: "bold", color: "#007bff" }}>{clientName}</span>
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "25px" }}>
        <div style={{ flex: 1, padding: "15px", border: "1px solid #eee", borderRadius: "6px", textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "5px" }}>Current Highest Bid</div>
          <span data-testid="current-bid" style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#28a745" }}>${highestBid}</span>
        </div>
        <div style={{ flex: 1, padding: "15px", border: "1px solid #eee", borderRadius: "6px", textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "5px" }}>Highest Bidder</div>
          <span data-testid="high-bidder" style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{highestBidder || "None"}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "25px", padding: "10px 15px", backgroundColor: "#fff3cd", border: "1px solid #ffeeba", borderRadius: "6px" }}>
        <strong>Time Remaining:</strong>
        <span data-testid="time-left" style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#856404" }}>{timeLeft}s</span>
      </div>

      {closed ? (
        <div
          data-testid="winner"
          style={{
            padding: "20px",
            backgroundColor: "#d4edda",
            color: "#155724",
            border: "1px solid #c3e6cb",
            borderRadius: "6px",
            marginBottom: "25px",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "1.1rem"
          }}
        >
          Winner: {highestBidder || "No one"} with ${highestBid}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
        <input
          type="number"
          data-testid="bid-input"
          value={bidValue}
          onChange={(e) => setBidValue(e.target.value)}
          disabled={closed}
          placeholder="Enter bid amount"
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            fontSize: "1rem"
          }}
        />
        <button
          type="submit"
          data-testid="place-bid"
          disabled={closed}
          style={{
            padding: "12px 24px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: closed ? "#6c757d" : "#007bff",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: closed ? "not-allowed" : "pointer",
            transition: "background-color 0.2s"
          }}
        >
          Place Bid
        </button>
      </form>

      {error ? (
        <div
          data-testid="bid-error"
          style={{
            color: "#721c24",
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            padding: "10px 15px",
            borderRadius: "6px",
            marginTop: "15px",
            fontWeight: "bold"
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
};
