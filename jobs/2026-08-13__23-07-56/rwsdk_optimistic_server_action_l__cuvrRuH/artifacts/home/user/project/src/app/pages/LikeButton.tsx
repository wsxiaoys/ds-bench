"use client";

import { incrementLike } from "./actions";

interface LikeButtonProps {
  initialCount: number;
}

export const LikeButton = ({ initialCount }: LikeButtonProps) => {
  const handleLike = async () => {
    await incrementLike();
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <h1>Persistent Like Button</h1>
      <p style={{ fontSize: "1.5rem" }}>
        Likes: <span data-testid="like-count">{initialCount}</span>
      </p>
      <button
        data-testid="like-button"
        onClick={handleLike}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          cursor: "pointer",
          borderRadius: "4px",
          border: "1px solid #ccc",
          backgroundColor: "#f0f0f0",
        }}
      >
        Like
      </button>
    </div>
  );
};
