"use server";

import { serverAction } from "rwsdk/worker";
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { likes } from "@/db/schema";

export const incrementLikes = serverAction(async () => {
  const db = drizzle(env.DB);
  await db.insert(likes).values({});
});
