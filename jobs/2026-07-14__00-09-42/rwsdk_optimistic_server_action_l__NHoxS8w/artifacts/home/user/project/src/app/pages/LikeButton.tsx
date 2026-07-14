"use client";

import { incrementLike } from "./actions";

export function LikeButton({ initialCount }: { initialCount: number }) {
  return (
    <div>
      <p>
        Likes: <span data-testid="like-count">{initialCount}</span>
      </p>
      <button data-testid="like-button" onClick={() => incrementLike()}>
        👍 Like
      </button>
    </div>
  );
}
