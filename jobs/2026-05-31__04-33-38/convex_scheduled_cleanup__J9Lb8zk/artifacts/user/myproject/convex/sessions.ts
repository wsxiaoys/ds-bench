import { mutation } from "./_generated/server";

export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const runId = process.env.ZEALT_RUN_ID;
    if (!runId) {
      throw new Error("ZEALT_RUN_ID environment variable not set");
    }
    const tableName = `sessions_${runId}`;
    const expiredSessions = await ctx.db
      .query(tableName as any)
      .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
      .collect();

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }
  },
});
