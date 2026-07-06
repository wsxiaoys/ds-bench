import { action, mutation } from "./_generated/server";
import { v } from "convex/values";

export const fetchAndSave = action({
  args: {},
  handler: async (ctx) => {
    const response = await fetch("https://jsonplaceholder.typicode.com/todos/1");
    const data = await response.json();

    const taskId = await ctx.runMutation(saveTask, {
      title: data.title,
    });
    return taskId;
  },
});

export const saveTask = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, { title }) => {
    const taskId = await ctx.db.insert("tasks_zrc1qtsh9c", {
      title,
      isCompleted: false,
    });
    return taskId;
  },
});
