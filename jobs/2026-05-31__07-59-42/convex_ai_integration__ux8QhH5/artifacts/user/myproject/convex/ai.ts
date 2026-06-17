import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("generations").collect();
  },
});

export const save = mutation({
  args: {
    prompt: v.string(),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("generations", {
      prompt: args.prompt,
      result: args.result,
    });
  },
});

export const generate = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: args.prompt,
          },
        ],
      }),
    });

    const data = await response.json();
    const result = data.choices[0].message.content;

    await ctx.runMutation(api.ai.save, {
      prompt: args.prompt,
      result: result,
    });
  },
});