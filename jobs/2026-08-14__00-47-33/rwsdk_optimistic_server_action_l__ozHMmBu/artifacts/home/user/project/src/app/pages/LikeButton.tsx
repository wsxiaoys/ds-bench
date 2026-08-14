"use client";

import { useTransition } from "react";
import { incrementLike } from "../actions";

export const LikeButton = ({ initialCount }: { initialCount: number }) => {
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    startTransition(async () => {
      await incrementLike();
    });
  };

  return (
    <div style={{ textAlign: "center", marginTop: "2rem", fontFamily: "sans-serif" }}>
      <h2>Like this page!</h2>
      <p>
        Current Likes:{" "}
        <span data-testid="like-count">{initialCount}</span>
      </p>
      <button
        data-testid="like-button"
        onClick={handleLike}
        disabled={isPending}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          cursor: isPending ? "not-allowed" : "pointer",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "4px",
        }}
      >
        {isPending ? "Liking..." : "Like"}
      </button>
    </div>
  );
};
