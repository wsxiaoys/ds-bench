"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { placeBidAction } from "./auctionActions";

interface AuctionState {
  itemId: string;
  name: string;
  startingPrice: number;
  timeLeft: number;
  currentBid: number;
  highBidder: string;
  closed: boolean;
}

interface AuctionRoomClientProps {
  itemId: string;
  myName: string;
  initialState: AuctionState;
}

export function AuctionRoomClient({ itemId, myName, initialState }: AuctionRoomClientProps) {
  const [state] = useSyncedState<AuctionState>(initialState, "auction", itemId);
  const [bidValue, setBidValue] = useState("");
  const [bidError, setBidError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidError("");

    const parsedBid = parseInt(bidValue, 10);
    if (isNaN(parsedBid)) {
      setBidError("Please enter a valid numeric bid");
      return;
    }

    try {
      const result = await placeBidAction(itemId, parsedBid, myName);
      if (!result.success) {
        setBidError(result.error || "Bid rejected");
      } else {
        setBidValue("");
      }
    } catch (err: any) {
      setBidError(err.message || "An unexpected error occurred");
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <header style={headerStyle}>
          <h1 data-testid="item-name" style={titleStyle}>
            {state.name}
          </h1>
          <p style={subtitleStyle}>
            Auction Room ID: <strong>{itemId}</strong>
          </p>
        </header>

        <section style={infoSectionStyle}>
          <div style={infoBoxStyle}>
            <span style={labelStyle}>Your Identity</span>
            <span data-testid="my-name" style={valueStyle}>
              {myName}
            </span>
          </div>

          <div style={infoBoxStyle}>
            <span style={labelStyle}>Time Remaining</span>
            <span data-testid="time-left" style={valueHighlightStyle}>
              {state.timeLeft}s
            </span>
          </div>
        </section>

        <section style={bidSectionStyle}>
          <div style={priceBoxStyle}>
            <span style={labelStyle}>Current Highest Bid</span>
            <span data-testid="current-bid" style={priceStyle}>
              ${state.currentBid}
            </span>
          </div>

          <div style={priceBoxStyle}>
            <span style={labelStyle}>Highest Bidder</span>
            <span data-testid="high-bidder" style={bidderStyle}>
              {state.highBidder || "No bids yet"}
            </span>
          </div>
        </section>

        {state.closed ? (
          <div data-testid="winner" style={winnerBannerStyle}>
            🎉 Auction Closed! Winner: <strong>{state.highBidder || "No winner"}</strong> with a winning bid of <strong>${state.currentBid}</strong>!
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={inputGroupStyle}>
              <label htmlFor="bid-amount" style={inputLabelStyle}>
                Place Your Bid (whole dollars)
              </label>
              <input
                id="bid-amount"
                type="number"
                data-testid="bid-input"
                value={bidValue}
                onChange={(e) => setBidValue(e.target.value)}
                placeholder={`Min: $${state.highBidder ? state.currentBid + 1 : state.startingPrice}`}
                style={inputStyle}
                disabled={state.closed}
              />
            </div>

            <button
              type="submit"
              data-testid="place-bid"
              disabled={state.closed}
              style={state.closed ? disabledButtonStyle : buttonStyle}
            >
              Submit Bid
            </button>
          </form>
        )}

        {bidError && (
          <div data-testid="bid-error" style={errorStyle}>
            ⚠️ {bidError}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Styles for simplicity & self-containment
const containerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  backgroundColor: "#f3f4f6",
  fontFamily: "'Noto Sans', sans-serif",
  padding: "20px",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  padding: "32px",
  maxWidth: "500px",
  width: "100%",
};

const headerStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: "16px",
  marginBottom: "24px",
  textAlign: "center",
};

const titleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0 0 8px 0",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  margin: 0,
};

const infoSectionStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "24px",
  gap: "16px",
};

const infoBoxStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: "#f9fafb",
  padding: "12px",
  borderRadius: "8px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
};

const valueStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#374151",
};

const valueHighlightStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#dc2626",
};

const bidSectionStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  backgroundColor: "#f3f4f6",
  padding: "16px",
  borderRadius: "8px",
  marginBottom: "24px",
  gap: "16px",
};

const priceBoxStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

const priceStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#059669",
};

const bidderStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#4b5563",
  wordBreak: "break-word",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const inputLabelStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "6px",
  border: "1px solid #d1d5db",
  fontSize: "16px",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "12px",
  borderRadius: "6px",
  fontSize: "16px",
  fontWeight: "600",
  border: "none",
  cursor: "pointer",
  transition: "background-color 0.2s",
};

const disabledButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#9ca3af",
  cursor: "not-allowed",
};

const winnerBannerStyle: React.CSSProperties = {
  backgroundColor: "#ecfdf5",
  border: "1px solid #10b981",
  color: "#065f46",
  padding: "16px",
  borderRadius: "8px",
  textAlign: "center",
  fontSize: "16px",
  fontWeight: "500",
  lineHeight: "1.5",
  marginBottom: "16px",
};

const errorStyle: React.CSSProperties = {
  backgroundColor: "#fef2f2",
  border: "1px solid #f87171",
  color: "#991b1b",
  padding: "12px",
  borderRadius: "6px",
  fontSize: "14px",
  marginTop: "16px",
};
