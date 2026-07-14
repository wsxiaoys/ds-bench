import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { likes } from "@/db/schema";
import { LikeButton } from "./LikeButton";

export async function Home() {
  const db = drizzle((env as Env).DB);

  // Fetch current like count; default to 0 if no row exists yet
  const rows = await db.select().from(likes).where(eq(likes.id, 1));
  const count = rows[0]?.count ?? 0;

  return (
    <main>
      <h1>Like Counter</h1>
      <LikeButton initialCount={count} />
    </main>
  );
}
