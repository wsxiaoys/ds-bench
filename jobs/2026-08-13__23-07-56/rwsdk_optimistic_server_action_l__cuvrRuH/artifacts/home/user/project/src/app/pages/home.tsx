import { getDb } from "@/db";
import { likes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { LikeButton } from "./LikeButton";

export const Home = async () => {
  const db = getDb();
  let count = 0;
  try {
    const result = await db.select().from(likes).where(eq(likes.id, 1)).get();
    if (result) {
      count = result.count;
    }
  } catch (err) {
    console.error("Error reading like count:", err);
  }

  return <LikeButton initialCount={count} />;
};
