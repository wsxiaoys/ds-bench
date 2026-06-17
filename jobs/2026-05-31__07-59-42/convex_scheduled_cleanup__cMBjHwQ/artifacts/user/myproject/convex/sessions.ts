import { mutation } from "./_generated/server";

export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const runId = process.env.ZEALT_RUN_ID;
    const tableName = `sessions_${runId}`;
    const now = Date.now();

    const expired = await ctx.db
      .query(tableName)
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const doc of expired) {
      await ctx.db.delete(doc._id);
    }
  },
});