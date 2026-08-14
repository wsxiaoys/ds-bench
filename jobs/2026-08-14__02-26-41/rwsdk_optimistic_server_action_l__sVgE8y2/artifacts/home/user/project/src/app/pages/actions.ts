"use server";

import { serverAction } from "rwsdk/worker";
import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";

export const incrementLike = serverAction(async () => {
  const db = drizzle(env.DB, { schema });
  const result = await db.select().from(schema.likes).execute();
  if (result.length > 0) {
    const row = result[0];
    await db
      .update(schema.likes)
      .set({ count: row.count + 1 })
      .where(eq(schema.likes.id, row.id))
      .execute();
  } else {
    await db.insert(schema.likes).values({ count: 1 }).execute();
  }
});
