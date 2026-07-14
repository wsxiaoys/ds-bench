import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { likes } from "@/db/schema";
import { count } from "drizzle-orm";
import { LikeButton } from "./like-button";

export const Home = async () => {
  const db = drizzle(env.DB);
  const result = await db.select({ value: count() }).from(likes);
  const currentLikes = result[0]?.value ?? 0;

  return <LikeButton count={currentLikes} />;
};
