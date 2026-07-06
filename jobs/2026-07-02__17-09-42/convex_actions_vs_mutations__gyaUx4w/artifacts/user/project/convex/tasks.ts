import { action, mutation } from "./_generated/server";
import { v } from "convex/values";

export const saveTask = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks_zrpy82jd8t", {
      title: args.title,
      isCompleted: false,
    });
    return taskId;
  },
});

export const fetchAndSave = action({
  args: {},
  handler: async (ctx) => {
    const response = await fetch(
      "https://jsonplaceholder.typicode.com/todos/1",
    );
    const data = await response.json();

    const taskId = await ctx.runMutation(saveTask, { title: data.title });
    return taskId;
  },
});
