"use client";

import React, { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

interface AuctionRoomProps {
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

export function AuctionRoom({ itemId, clientName, initialData }: AuctionRoomProps) {
  // Sync state with Durable Object
  const [currentBid] = useSyncedState(initialData.currentBid, "currentBid", itemId);
  const [highBidder] = useSyncedState(initialData.highBidder, "highBidder", itemId);
  const [timeLeft] = useSyncedState(initialData.timeLeft, "timeLeft", itemId);
  const [closed] = useSyncedState(initialData.closed, "closed", itemId);
  const [winnerName] = useSyncedState(initialData.winnerName, "winnerName", itemId);
  const [winningAmount] = useSyncedState(initialData.winningAmount, "winningAmount", itemId);

  // Local state for bid input and errors
  const [bidValue, setBidValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const bidNum = parseInt(bidValue, 10);
    if (isNaN(bidNum)) {
      setError("Please enter a valid whole number");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/bid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId,
          name: clientName,
          bid: bidNum,
        }),
      });

      const result = await response.json() as { success: boolean; error?: string };
      if (result.success) {
        setBidValue("");
      } else {
        setError(result.error || "Bid rejected");
      }
    } catch (err) {
      setError("Failed to place bid. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine item's display name
  const itemName = itemId === "lot-42" ? "Sunburst Electric Guitar" : `Auction Item ${itemId}`;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 data-testid="item-name" style={styles.title}>
          {itemName}
        </h1>

        <div style={styles.infoGrid}>
          <div style={styles.infoBox}>
            <span style={styles.label}>Your Identity</span>
            <span data-testid="my-name" style={styles.value}>
              {clientName}
            </span>
          </div>

          <div style={styles.infoBox}>
            <span style={styles.label}>Time Left</span>
            <span data-testid="time-left" style={styles.value}>
              {timeLeft}s
            </span>
          </div>

          <div style={styles.infoBox}>
            <span style={styles.label}>Current Highest Bid</span>
            <span data-testid="current-bid" style={styles.bidValue}>
              ${currentBid}
            </span>
          </div>

          <div style={styles.infoBox}>
            <span style={styles.label}>Highest Bidder</span>
            <span data-testid="high-bidder" style={styles.value}>
              {highBidder || ""}
            </span>
          </div>
        </div>

        {closed && (
          <div data-testid="winner" style={styles.winnerBanner}>
            🏆 Winner: <strong>{winnerName}</strong> with a bid of <strong>${winningAmount}</strong>!
          </div>
        )}

        <form onSubmit={handlePlaceBid} style={styles.form}>
          <div style={styles.inputGroup}>
            <input
              data-testid="bid-input"
              type="number"
              value={bidValue}
              onChange={(e) => setBidValue(e.target.value)}
              placeholder="Enter your bid amount"
              style={styles.input}
              disabled={closed}
            />
            <button
              data-testid="place-bid"
              type="submit"
              disabled={closed}
              style={{
                ...styles.button,
                ...(closed ? styles.buttonDisabled : {}),
              }}
            >
              {isSubmitting ? "Placing..." : "Place Bid"}
            </button>
          </div>
          {error && (
            <div data-testid="bid-error" style={styles.error}>
              ❌ {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Noto Sans', sans-serif",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f0f2f5",
    padding: "20px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    padding: "32px",
    width: "100%",
    maxWidth: "600px",
  },
  title: {
    fontSize: "28px",
    color: "#1a1a1a",
    marginBottom: "24px",
    textAlign: "center" as const,
    fontWeight: "700",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "32px",
  },
  infoBox: {
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    border: "1px solid #e9ecef",
  },
  label: {
    fontSize: "12px",
    color: "#6c757d",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  value: {
    fontSize: "18px",
    color: "#212529",
    fontWeight: "600",
  },
  bidValue: {
    fontSize: "24px",
    color: "#28a745",
    fontWeight: "700",
  },
  winnerBanner: {
    backgroundColor: "#d4edda",
    color: "#155724",
    border: "1px solid #c3e6cb",
    borderRadius: "8px",
    padding: "20px",
    fontSize: "20px",
    textAlign: "center" as const,
    fontWeight: "600",
    boxShadow: "0 2px 4px rgba(40, 167, 69, 0.1)",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  inputGroup: {
    display: "flex",
    gap: "12px",
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    outline: "none",
    transition: "border-color 0.15s ease-in-out",
  },
  button: {
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#007bff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.15s ease-in-out",
  },
  buttonDisabled: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed",
  },
  error: {
    color: "#dc3545",
    fontSize: "14px",
    fontWeight: "500",
  },
};
