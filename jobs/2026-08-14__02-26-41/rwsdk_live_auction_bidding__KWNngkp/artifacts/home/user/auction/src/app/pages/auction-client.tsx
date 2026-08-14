"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { placeBid } from "../actions";

interface AuctionRoomClientProps {
  itemId: string;
  itemName: string;
  myName: string;
  startingPrice: number;
  duration: number;
}

export function AuctionRoomClient({
  itemId,
  itemName,
  myName,
  startingPrice,
  duration,
}: AuctionRoomClientProps) {
  // Sync state with server/other clients
  const [timeLeft] = useSyncedState(duration, "timeLeft", itemId);
  const [currentBid] = useSyncedState(startingPrice, "currentBid", itemId);
  const [highBidder] = useSyncedState("", "highBidder", itemId);
  const [closed] = useSyncedState(false, "closed", itemId);

  // Local state
  const [bidInput, setBidInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isClosed = closed || timeLeft <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseInt(bidInput, 10);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid whole dollar amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await placeBid(itemId, myName, amount);
      if (result.success) {
        setBidInput("");
      } else {
        setError(result.error || "Your bid was rejected.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while placing your bid.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      maxWidth: "600px",
      margin: "40px auto",
      padding: "20px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      backgroundColor: "#fff",
      color: "#333"
    }}>
      <h1 data-testid="item-name" style={{ marginTop: 0, fontSize: "2rem", color: "#111" }}>
        {itemName}
      </h1>

      <div style={{ display: "flex", gap: "20px", margin: "20px 0", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "150px", padding: "10px", background: "#f5f5f5", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>Current Bid</div>
          <div data-testid="current-bid" style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#2e7d32" }}>
            ${currentBid}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: "150px", padding: "10px", background: "#f5f5f5", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>Highest Bidder</div>
          <div data-testid="high-bidder" style={{ fontSize: "1.5rem", fontWeight: "600" }}>
            {highBidder || "No bids yet"}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: "150px", padding: "10px", background: "#f5f5f5", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", textTransform: "uppercase" }}>Time Remaining</div>
          <div data-testid="time-left" style={{ fontSize: "1.8rem", fontWeight: "bold", color: isClosed ? "#c62828" : "#1565c0" }}>
            {timeLeft}s
          </div>
        </div>
      </div>

      <div style={{ margin: "20px 0", padding: "10px 15px", background: "#e3f2fd", borderRadius: "6px" }}>
        <span>Logged in as: </span>
        <strong data-testid="my-name">{myName}</strong>
      </div>

      {isClosed ? (
        <div data-testid="winner" style={{
          margin: "25px 0",
          padding: "20px",
          background: "#e8f5e9",
          border: "2px solid #2e7d32",
          borderRadius: "8px",
          textAlign: "center",
          fontSize: "1.2rem",
          fontWeight: "bold",
          color: "#1b5e20"
        }}>
          🏆 Winner: {highBidder || "None"} with ${currentBid}!
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ margin: "25px 0" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              data-testid="bid-input"
              type="number"
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
              placeholder={`Enter bid (min $${highBidder ? currentBid + 1 : startingPrice})`}
              style={{
                flex: 1,
                padding: "12px",
                fontSize: "1rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
                outline: "none"
              }}
            />
            <button
              data-testid="place-bid"
              type="submit"
              disabled={isClosed}
              style={{
                padding: "12px 24px",
                fontSize: "1rem",
                fontWeight: "bold",
                backgroundColor: isClosed ? "#ccc" : "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isClosed ? "not-allowed" : "pointer",
                transition: "background-color 0.2s"
              }}
            >
              Place Bid
            </button>
          </div>
        </form>
      )}

      {error && (
        <div data-testid="bid-error" style={{
          padding: "12px",
          backgroundColor: "#ffebee",
          border: "1px solid #c62828",
          color: "#c62828",
          borderRadius: "6px",
          marginTop: "15px",
          fontWeight: "500"
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
