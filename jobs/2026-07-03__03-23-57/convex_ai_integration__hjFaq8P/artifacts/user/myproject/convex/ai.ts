import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

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
    const id = await ctx.db.insert("generations", {
      prompt: args.prompt,
      result: args.result,
    });
    return id;
  },
});

export const generate = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in the environment variables");
    }

    const response = await fetch("REDACTED/chat/completions", {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";

    // Call the api.ai.save mutation to store prompt and result
    await ctx.runMutation(api.ai.save, {
      prompt: args.prompt,
      result: result,
    });

    return result;
  },
});
