"use client";

import { useTransition } from "react";
import { incrementLikes } from "../actions";

export const LikeButton = ({ count }: { count: number }) => {
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    startTransition(async () => {
      await incrementLikes();
    });
  };

  return (
    <div style={{ fontFamily: "Noto Sans, sans-serif", padding: "2rem", textAlign: "center" }}>
      <h2>Persistent Like Button</h2>
      <div style={{ fontSize: "3rem", margin: "1rem 0" }}>
        Likes: <span data-testid="like-count">{count}</span>
      </div>
      <button
        data-testid="like-button"
        onClick={handleLike}
        disabled={isPending}
        style={{
          fontSize: "1.5rem",
          padding: "0.5rem 1.5rem",
          cursor: "pointer",
          borderRadius: "8px",
          border: "1px solid #ccc",
          backgroundColor: isPending ? "#eee" : "#0070f3",
          color: isPending ? "#666" : "#fff",
        }}
      >
        {isPending ? "Liking..." : "Like"}
      </button>
    </div>
  );
};
