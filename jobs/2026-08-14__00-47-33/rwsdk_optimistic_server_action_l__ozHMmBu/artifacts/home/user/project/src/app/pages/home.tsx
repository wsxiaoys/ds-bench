import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { likes } from "../../db/schema";
import { eq } from "drizzle-orm";
import { LikeButton } from "./LikeButton";

export const Home = async () => {
  const db = drizzle(env.DB);
  const result = await db.select().from(likes).where(eq(likes.id, 1)).get();
  const count = result ? result.count : 0;

  return (
    <div style={{ padding: "2rem" }}>
      <LikeButton initialCount={count} />
    </div>
  );
};
