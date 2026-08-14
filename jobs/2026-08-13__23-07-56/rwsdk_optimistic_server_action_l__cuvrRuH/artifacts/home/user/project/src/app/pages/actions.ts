"use server";

import { serverAction } from "rwsdk/worker";
import { getDb } from "@/db";
import { likes } from "@/db/schema";
import { sql } from "drizzle-orm";

export const incrementLike = serverAction(async () => {
  const db = getDb();
  await db
    .insert(likes)
    .values({ id: 1, count: 1 })
    .onConflictDoUpdate({
      target: likes.id,
      set: { count: sql`${likes.count} + 1` },
    });
});
