"use server";

import { sql } from "drizzle-orm";
import { serverAction } from "rwsdk/worker";

import { db } from "@/db";
import { likes } from "@/db/schema";

const SINGLETON_ID = 1;

/**
 * Increment the persisted like count by exactly one.
 *
 * Wrapped with RedwoodSDK's `serverAction` so that, when invoked from a
 * client component, the React page re-renders with the new value after
 * the action resolves.
 */
export const incrementLike = serverAction(async function incrementLike() {
  // Make sure the singleton row exists. On a brand new database the row is
  // missing; the very first click needs to create it.
  await db.run(sql`
    INSERT OR IGNORE INTO likes (id, count, updated_at)
    VALUES (${SINGLETON_ID}, 0, '')
  `);

  // Atomically bump the counter by one.
  const updated = await db
    .update(likes)
    .set({
      count: sql`${likes.count} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(sql`${likes.id} = ${SINGLETON_ID}`)
    .returning({ count: likes.count });

  return updated[0]?.count ?? 1;
});
