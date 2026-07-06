import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// `process.env` is provided by the Convex action runtime.
declare const process: { env: { OPENAI_API_KEY?: string } };

/**
 * Query: api.ai.list
 * Returns all records from the generations table, newest first.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("generations").order("desc").collect();
  },
});

/**
 * Mutation: api.ai.save
 * Inserts a new generation record with the given prompt and result.
 */
export const save = mutation({
  args: {
    prompt: v.string(),
    result: v.string(),
  },
  handler: async (ctx, { prompt, result }) => {
    const id = await ctx.db.insert("generations", { prompt, result });
    return id;
  },
});

/**
 * Action: api.ai.generate
 * Calls the OpenAI chat completions API with the provided prompt,
 * then saves the result via the `save` mutation.
 */
export const generate = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, { prompt }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured in the Convex deployment environment.",
      );
    }

    const response = await fetch(
      "REDACTED/chat/completions",
      {
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
              content: prompt,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | null };
      }>;
    };
    const result: string =
      data?.choices?.[0]?.message?.content?.toString()?.trim() ?? "";

    if (!result) {
      throw new Error("OpenAI API returned an empty completion.");
    }

    await ctx.runMutation(api.ai.save, { prompt, result });

    return result;
  },
});