"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

import type { AuctionSnapshot } from "@/durableObjects/auctionRoom";
import { placeBid } from "./functions";

export function AuctionClient({
  itemId,
  myName,
  initialSnapshot,
}: {
  itemId: string;
  myName: string;
  initialSnapshot: AuctionSnapshot;
}) {
  // Realtime, server-synchronized auction state. The server (an alarm-driven
  // Durable Object) is the sole writer; every open client watching this
  // `itemId` receives the same pushes, including the once-a-second countdown
  // tick and the final "closed" snapshot.
  const [snapshot, setSnapshot] = useSyncedState<AuctionSnapshot>(
    initialSnapshot,
    "auction",
    itemId,
  );

  const [bidValue, setBidValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentBid = snapshot.highestBid ?? snapshot.startingPrice;
  const closed = snapshot.closed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (closed || submitting) return;

    const amount = Number(bidValue);
    setSubmitting(true);
    try {
      const result = await placeBid(itemId, myName, amount);
      if (!result.ok) {
        setError(result.error ?? "Bid rejected.");
      } else {
        setError(null);
        setBidValue("");
        // Reflect the accepted bid immediately for the bidder; other open
        // clients get the same update via the realtime broadcast.
        setSnapshot(result.snapshot);
      }
    } catch (err) {
      setError("Could not submit bid. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1 data-testid="item-name">{snapshot.name}</h1>

      <p>
        Viewing as <strong data-testid="my-name">{myName}</strong>
      </p>

      <p>
        Current bid:{" "}
        <strong data-testid="current-bid">${currentBid}</strong>
      </p>

      <p>
        Highest bidder: <span data-testid="high-bidder">{snapshot.highestBidder ?? ""}</span>
      </p>

      <p>
        Time left: <span data-testid="time-left">{snapshot.timeLeft}s</span>
      </p>

      {closed && snapshot.winner && (
        <div
          data-testid="winner"
          style={{
            padding: "1rem",
            margin: "1rem 0",
            background: "#e6ffed",
            border: "1px solid #2ecc71",
            borderRadius: 8,
          }}
        >
          🏆 {snapshot.winner.name} won the auction with a bid of $
          {snapshot.winner.amount}!
        </div>
      )}

      {closed && !snapshot.winner && (
        <div data-testid="winner" style={{ padding: "1rem", margin: "1rem 0" }}>
          Auction closed with no bids.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          data-testid="bid-input"
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          value={bidValue}
          disabled={closed}
          onChange={(e) => setBidValue(e.target.value)}
          placeholder={`Min $${snapshot.highestBid === null ? snapshot.startingPrice : snapshot.highestBid + 1}`}
        />
        <button data-testid="place-bid" type="submit" disabled={closed || submitting}>
          Place bid
        </button>
      </form>

      {error && (
        <p data-testid="bid-error" style={{ color: "#c0392b" }}>
          {error}
        </p>
      )}
    </div>
  );
}
