import { eq } from "drizzle-orm";

import { LikeButton } from "@/app/likes/LikeButton";
import { db } from "@/db";
import { likes } from "@/db/schema";

const SINGLETON_ID = 1;

/**
 * Read the persisted like count from D1.
 *
 * The `likes` table holds at most one row (id = 1). When the row is
 * missing, we treat the count as 0 so a fresh database starts at zero.
 */
async function getLikeCount(): Promise<number> {
  const row = await db
    .select({ count: likes.count })
    .from(likes)
    .where(eq(likes.id, SINGLETON_ID))
    .limit(1);

  return row[0]?.count ?? 0;
}

export const Home = async () => {
  const count = await getLikeCount();

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
      }}
    >
      <h1>Like Button Demo</h1>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <LikeButton />
        <span data-testid="like-count">{count}</span>
      </div>
    </main>
  );
};
