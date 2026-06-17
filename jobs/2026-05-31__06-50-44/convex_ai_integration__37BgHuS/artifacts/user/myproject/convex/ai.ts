import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
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
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: args.prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    if (!result) {
      throw new Error("OpenAI API returned an empty response");
    }

    await ctx.runMutation(api.ai.save, {
      prompt: args.prompt,
      result,
    });

    return result;
  },
});
