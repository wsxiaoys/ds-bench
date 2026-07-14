"use client";

import { useTransition } from "react";

import { incrementLike } from "./actions";

/**
 * Client component that renders the "Like" button. Clicking it invokes
 * the `incrementLike` serverAction, which mutates D1 and triggers a
 * re-render of the route so the visible count is refreshed.
 */
export function LikeButton() {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      void incrementLike();
    });
  };

  return (
    <button
      type="button"
      data-testid="like-button"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Liking…" : "Like"}
    </button>
  );
}
