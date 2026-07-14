"use server";

import { serverAction } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import { likes } from "@/db/schema";

export const incrementLike = serverAction(async () => {
  const db = drizzle((env as Env).DB);

  // Insert seed row if it doesn't exist; otherwise increment count by 1
  await db
    .insert(likes)
    .values({ id: 1, count: 1 })
    .onConflictDoUpdate({
      target: likes.id,
      set: { count: sql`${likes.count} + 1` },
    });
});
