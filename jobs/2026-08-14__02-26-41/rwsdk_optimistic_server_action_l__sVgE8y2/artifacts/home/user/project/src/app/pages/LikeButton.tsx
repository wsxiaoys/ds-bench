"use client";

import React, { useTransition } from "react";
import { incrementLike } from "./actions";

interface LikeButtonProps {
  initialCount: number;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ initialCount }) => {
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    startTransition(async () => {
      await incrementLike();
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Persistent Like Button</h1>
      <p>
        Likes: <span data-testid="like-count">{initialCount}</span>
      </p>
      <button
        data-testid="like-button"
        onClick={handleLike}
        disabled={isPending}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "5px",
        }}
      >
        {isPending ? "Liking..." : "Like"}
      </button>
    </div>
  );
};
