import { internalMutation } from "./_generated/server";

export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }
    return { deleted: tasks.length };
  },
});
