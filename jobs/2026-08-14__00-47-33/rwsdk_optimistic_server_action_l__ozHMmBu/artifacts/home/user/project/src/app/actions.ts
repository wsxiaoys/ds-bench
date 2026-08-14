"use server";

import { serverAction } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { likes } from "../db/schema";
import { eq } from "drizzle-orm";

export const incrementLike = serverAction(async () => {
  const db = drizzle(env.DB);
  const result = await db.select().from(likes).where(eq(likes.id, 1)).get();
  if (!result) {
    await db.insert(likes).values({ id: 1, count: 1 });
  } else {
    await db.update(likes).set({ count: result.count + 1 }).where(eq(likes.id, 1));
  }
});
